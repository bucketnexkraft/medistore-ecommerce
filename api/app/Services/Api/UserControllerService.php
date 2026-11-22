<?php

namespace App\Services\Api;

use App\Data\FeaturePreference;
use App\Models\Company;
use App\Models\CompanyFeaturePreference;
use App\Models\PosSetting;
use App\Models\Role;
use App\Models\User;
use App\Services\ImageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class UserControllerService
{
    private function decorateRoleDisplay(User $user): User
    {
        $roleName = $user->resolveRoleName();
        $user->setAttribute('role_name', $roleName);

        if ((int) $user->role === User::ECOMMERCE_USER_ROLE) {
            $role = $user->roles instanceof Role ? $user->roles : new Role();
            $role->id = $user->role;
            $role->name = $roleName;
            $role->company_id = $user->company_id;
            $user->setRelation('roles', $role);
        } elseif ($user->relationLoaded('roles') && $user->roles) {
            $user->roles->name = $roleName;
        }

        return $user;
    }

    private function isProtectedCompanyUser(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        $authUser = Auth::user();
        if (! $authUser) {
            return false;
        }

        if ((string) $user->id === (string) $authUser->id) {
            return true;
        }

        $companyOwnerId = Company::query()
            ->where('company_id', $authUser->company_id)
            ->value('user_id');

        return ! empty($companyOwnerId) && (string) $user->id === (string) $companyOwnerId;
    }

    private function scopeUsersForCompany($query, string $companyId)
    {
        return $query->where(function ($scopedQuery) use ($companyId) {
            $scopedQuery
                ->where('company_id', $companyId)
                ->orWhere(function ($legacyQuery) use ($companyId) {
                    $legacyQuery
                        ->whereNull('company_id')
                        ->whereHas('roles', fn ($roleQuery) => $roleQuery->where('company_id', $companyId));
                });
        });
    }

    public function list(Request $request)
    {
        $authUser = Auth::user();

        // Extract filters and pagination details from the request
        $perPage = $request->input('perPage', 20); // Default to 20 items per page
        $page = $request->input('page', 1);
        $filterText = $request->input('search', '');
        $filterRole = $request->input('role', '');
        $filterStatus = $request->input('status', '');
        $sortField = $request->input('sortField', 'created_at'); // Default to 'id'
        $sortOrder = $request->input('sortOrder', 'desc'); // Default to ascending
        $allowedSortFields = ['first_name', 'last_name', 'email', 'phone', 'status', 'created_at'];
        $sortField = in_array($sortField, $allowedSortFields, true) ? $sortField : 'created_at';
        $sortOrder = strtolower($sortOrder) === 'asc' ? 'asc' : 'desc';

        // Query the users with optional filters
        $query = User::with('roles', 'company');

        if ($authUser && $authUser->company_id) {
            $this->scopeUsersForCompany($query, (string) $authUser->company_id);
        } elseif (! $authUser?->isSuperAdmin()) {
            $query->whereRaw('1 = 0');
        }

        if ((string) $filterRole !== '2') {
            $query->where('role', '<>', 2)
                ->where(function ($q) {
                    $q->whereNull('is_default')
                        ->orWhere('is_default', 0);
                });
        }

        // Filter by text (search across name, email, or phone fields)
        if (! empty($filterText)) {
            $query->where(function ($q) use ($filterText) {
                $q->where('first_name', 'LIKE', "%{$filterText}%")
                    ->orWhere('last_name', 'LIKE', "%{$filterText}%")
                    ->orWhere('email', 'LIKE', "%{$filterText}%")
                    ->orWhere('phone', 'LIKE', "%{$filterText}%");
            });
        }

        // Filter by role
        if (! empty($filterRole)) {
            $query->whereHas('roles', function ($q) use ($filterRole) {
                $q->where('id', $filterRole);
            });
        }

        // Filter by status
        if ($filterStatus !== '' && ! is_null($filterStatus)) {
            $query->where('status', $filterStatus);
        }

        // Apply sorting
        $query->orderBy($sortField, $sortOrder);

        // Get paginated data
        $data = $query->paginate($perPage, ['*'], 'page', $page);
        $items = collect($data->items())
            ->map(fn (User $user) => $this->decorateRoleDisplay($user))
            ->values()
            ->all();

        // Fetch all roles for the filters dropdown
        $roles = Role::query()
            ->when($authUser?->company_id, fn ($q) => $q->where('company_id', $authUser->company_id))
            ->get();

        // Return the response
        return response()->json([
            'status' => 1,
            'message' => 'Data retrieved successfully!',
            'data' => $items, // Current page items
            'meta' => [
                'current_page' => $data->currentPage(),
                'per_page' => $data->perPage(),
                'total' => $data->total(),
                'last_page' => $data->lastPage(),
            ],
            'others_data' => [
                'roles' => $roles,
            ],
        ], 200);
    }

    public function store(Request $request)
    {
        $authUser = Auth::user();

        if ($authUser?->company_id && ! $authUser->isSuperAdmin()) {
            $company = Company::query()
                ->with('saasPlan')
                ->where('company_id', $authUser->company_id)
                ->first();
            $userLimit = (int) ($company?->saasPlan?->user_limit ?? 0);

            if ($userLimit > 0) {
                $managedUserCount = User::withoutGlobalScopes()
                    ->where('company_id', $authUser->company_id)
                    ->where('role', '<>', 2)
                    ->when($company?->user_id, fn ($query) => $query->where('id', '!=', $company->user_id))
                    ->count();

                if ($managedUserCount >= $userLimit) {
                    return response()->json([
                        'status' => 0,
                        'message' => "Your plan allows up to {$userLimit} team users. Please upgrade your plan to add another user.",
                        'errors' => ["User limit of {$userLimit} reached."],
                    ], 422);
                }
            }
        }

        // Validate incoming request
        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => [
                'required',
                'email',
                Rule::unique('user', 'email')->where(function ($query) {
                    return $query->where('company_id', Auth::user()->company_id);
                }),
            ],
            'phone' => [
                'required',
                'max:20',
                Rule::unique('user', 'phone')->where(function ($query) {
                    return $query->where('company_id', Auth::user()->company_id);
                }),
            ],
            'role' => [
                'required',
                Rule::exists('role', 'id')->where(function ($query) {
                    return $query->where('company_id', Auth::user()->company_id);
                }),
            ],
            'status' => 'required',
            'password' => 'nullable|min:6|max:20|confirmed',
            'private_code' => 'nullable|string|min:4|max:100',
            'warehouse_id' => [
                'nullable',
                Rule::exists('warehouses', 'id')->where(function ($query) {
                    return $query->where('company_id', Auth::user()->company_id);
                }),
            ],
        ]);
        // If validation fails, return error response
        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors(),
            ], 422);
        }

        // Begin database transaction
        DB::beginTransaction();

        try {
            $authUser = Auth::user();
            $isCreatingCompanyOwner = $request->role == 4 && ! $authUser?->company_id;

            // Create the user
            $user = new User;
            $user->first_name = $request->first_name;
            $user->last_name = $request->last_name;
            $user->email = $request->email;
            $user->phone = $request->phone;
            $user->role = $request->role;
            $user->status = $request->status;
            $user->company_id = $isCreatingCompanyOwner ? null : $authUser?->company_id;
            $user->password = Hash::make($request->password ?? $request->phone); // Fallback to phone if no password
            $user->private_code = $request->filled('private_code')
                ? Hash::make($request->private_code)
                : null;
            $user->warehouse_id = $request->role != 4 ? $request->warehouse_id : null; // Set warehouse_id only if role is not 4

            // If a profile image is provided, handle the upload
            if ($request->hasFile('thumbnail')) {
                $user->profile_image = ImageService::upload($request->file('thumbnail'), 'user-images', [
                    'extensions' => ['jpg', 'jpeg', 'png', 'gif'],
                    'mime_types' => ['image/jpeg', 'image/png', 'image/gif'],
                    'max_kb' => 2048,
                    'field' => 'thumbnail',
                ]);
            }

            $user->save();

            // If role is 4, create the company
            if ($isCreatingCompanyOwner) {
                $company = new Company;
                $company->type = $user->role;
                $company->user_id = $user->id;
                $company->contact_name = $request->contact_name;
                $company->name = $request->company_name;
                $company->phone_number = $request->company_phone_number;
                $company->department = $request->department;
                $company->vat_no = $request->vat_no;
                $company->reg_number = $request->reg_number;
                $company->tin_number = $request->tin_number;
                $company->bin_number = $request->bin_number;
                $company->email = $request->company_email;
                $company->address = $request->address;
                $company->post_code = $request->post_code;
                $company->state = $request->state;
                $company->city = $request->city;
                $company->country = $request->country;
                $company->website_url = $request->website_url;
                $company->status = $request->status;
                $company->save();

                $user->company_id = $company->company_id;
                $user->save();

                foreach (FeaturePreference::defaultsForInsert($company->company_id) as $preference) {
                    CompanyFeaturePreference::create($preference);
                }

                // Default Customer creation
                $defaultCustomer = new User;
                $defaultCustomer->first_name = 'Walking';
                $defaultCustomer->last_name = 'Customer';
                $defaultCustomer->email = 'walking@gmail.com';
                $defaultCustomer->phone = '01xxxxxxxxx';
                $defaultCustomer->role = 2;
                $defaultCustomer->status = 1;
                $defaultCustomer->is_default = 1;
                $defaultCustomer->company_id = $company->company_id;
                $defaultCustomer->password = Hash::make('12345678');
                $defaultCustomer->save();

                // Default Pos Setup
                $posSetup = new PosSetting;
                $posSetup->company_id = $company->company_id;
                $posSetup->key = 'payment_methods';
                $paymentMethods = [
                    ['name' => 'Cash', 'config' => [], 'enabled' => true],
                    ['name' => 'Card', 'config' => ['last_digit_length' => [5, 6], 'require_last_digits' => false], 'enabled' => true],
                    ['name' => 'QR Payment', 'config' => ['providers' => ['bKash', 'Nagad', 'Rocket', 'Upay']], 'enabled' => false],
                    ['name' => 'Reward Points', 'config' => [], 'enabled' => false],
                    ['name' => 'Cash Refund', 'config' => [], 'enabled' => false],
                    ['name' => 'Refund to Card', 'config' => ['last_digit_length' => [5, 6], 'require_last_digits' => true], 'enabled' => false],
                    ['name' => 'Refund to MF', 'config' => ['providers' => ['bKash', 'Nagad', 'Rocket', 'Upay']], 'enabled' => false],
                ];
                $posSetup->value = json_encode($paymentMethods, JSON_UNESCAPED_SLASHES);
                $posSetup->save();
            }

            // Commit the transaction
            DB::commit();

            // Return success response
            return response()->json([
                'status' => 1,
                'message' => 'User created successfully',
                'user' => $this->decorateRoleDisplay($user->loadMissing('roles', 'company')),
            ], 200);
        } catch (\Exception $e) {
            // Rollback the transaction on error
            DB::rollBack();

            // Return error response
            return response()->json([
                'status' => 0,
                'message' => 'Failed to create user',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $authUser = Auth::user();
        $companyOwnerId = $authUser?->company_id
            ? Company::query()->where('company_id', $authUser->company_id)->value('user_id')
            : null;
        $targetUser = User::withoutGlobalScopes()->where('id', $id)->first();
        $isCompanyOwner = $targetUser
            && $companyOwnerId
            && (string) $targetUser->id === (string) $companyOwnerId;

        $roleRules = ['required'];
        if ($isCompanyOwner) {
            // The owner role is a system role and may not exist in the company's role table.
            // Keep it fixed while allowing the owner's profile details to be edited.
            $roleRules[] = Rule::in([(int) $targetUser->role]);
        } elseif ($authUser?->company_id) {
            $roleRules[] = Rule::exists('role', 'id')->where(function ($query) use ($authUser) {
                return $query->where('company_id', $authUser->company_id);
            });
        } else {
            $roleRules[] = Rule::exists('role', 'id');
        }

        // Validate incoming request
        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => [
                'required',
                'email',
                Rule::unique('user', 'email')->where(function ($query) use ($id) {
                    return $query->where('company_id', Auth::user()->company_id)
                        ->where('id', '!=', $id);
                }),
            ],
            'phone' => [
                'required',
                'max:15',
                Rule::unique('user', 'phone')->where(function ($query) use ($id) {
                    return $query->where('company_id', Auth::user()->company_id)
                        ->where('id', '!=', $id);
                }),
            ],
            'role' => $roleRules,
            'status' => 'required|in:0,1',
            'password' => 'nullable|min:6|max:20|confirmed',
            'private_code' => 'nullable|string|min:4|max:100',
            'warehouse_id' => [
                'nullable',
                Rule::exists('warehouses', 'id')->where(function ($query) {
                    return $query->where('company_id', Auth::user()->company_id);
                }),
            ],
            'thumbnail' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        // If validation fails, return error response
        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors(),
            ], 422);
        }

        // Begin database transaction
        DB::beginTransaction();

        try {
            // Find the user
            $query = User::query()->where('id', $id);

            if ($authUser?->company_id) {
                $this->scopeUsersForCompany($query, (string) $authUser->company_id);
            } elseif (! $authUser?->isSuperAdmin()) {
                $query->whereRaw('1 = 0');
            }

            $user = $query->firstOrFail();
            $user->first_name = $request->first_name;
            $user->last_name = $request->last_name;
            $user->email = $request->email;
            $user->phone = $request->phone;
            $user->role = $isCompanyOwner ? $targetUser->role : $request->role;
            $user->status = $request->status;
            $user->company_id = $authUser?->company_id ?: ($request->role == 4 ? null : $user->company_id);
            $user->warehouse_id = ! in_array((int) $user->role, [4, User::ECOMMERCE_COMPANY_ROLE], true)
                ? $request->warehouse_id
                : null;

            // Update password only if provided
            if ($request->filled('password')) {
                $user->password = Hash::make($request->password);
            }
            if ($request->filled('private_code')) {
                $user->private_code = Hash::make($request->private_code);
            }

            // Handle profile image upload
            if ($request->hasFile('thumbnail')) {
                // Delete old image if exists
                if ($user->profile_image) {
                    ImageService::delete($user->profile_image, 'user-images');
                }
                $user->profile_image = ImageService::upload($request->file('thumbnail'), 'user-images', [
                    'extensions' => ['jpg', 'jpeg', 'png', 'gif'],
                    'mime_types' => ['image/jpeg', 'image/png', 'image/gif'],
                    'max_kb' => 2048,
                    'field' => 'thumbnail',
                ]);
            }

            $user->save();

            // Commit the transaction
            DB::commit();

            // Return success response
            return response()->json([
                'status' => 1,
                'message' => 'User updated successfully',
                'user' => $this->decorateRoleDisplay($user->load('company', 'roles')),
            ], 200);
        } catch (\Exception $e) {
            // Rollback the transaction on error
            DB::rollBack();

            // Return error response
            return response()->json([
                'status' => 0,
                'message' => 'Failed to update user',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function updateStatus(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'ids' => 'required|array',
            'ids.*' => 'required|exists:user,id',
            'status' => 'required|in:0,1',
        ]);

        if ($validator->fails()) {
            return response()->json(
                [
                    'status' => 0,
                    'errors' => $validator->messages()->all(),
                ],
                422
            );
        }

        $data = $validator->validated();

        DB::beginTransaction();

        try {
            $protectedUsers = User::query()
                ->whereIn('id', $data['ids'])
                ->get()
                ->filter(fn (User $user) => $this->isProtectedCompanyUser($user));

            if ($protectedUsers->isNotEmpty()) {
                return response()->json(
                    [
                        'status' => 0,
                        'message' => 'You cannot deactivate your own account or the company owner account.',
                    ],
                    422
                );
            }

            User::whereIn('id', $data['ids'])->update([
                'status' => $data['status'],
            ]);

            DB::commit();

            return response()->json(
                [
                    'status' => 1,
                    'message' => 'User statuses updated successfully',
                ],
                200
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Failed to update user statuses',
                    'error' => $e->getMessage(),
                ],
                500
            );
        }
    }

    public function delete(Request $request, $id = null)
    {
        // Handle single or bulk deletion
        $ids = $id ? [$id] : $request->input('ids', []);

        if (empty($ids)) {
            return response()->json(
                [
                    'status' => 0,
                    'message' => 'No user IDs provided.',
                ],
                422
            );
        }

        $request->validate([
            'ids' => 'sometimes|required|array',
            'ids.*' => 'exists:user,id',
        ]);

        DB::beginTransaction();

        try {

            $failedIds = [];
            foreach ($ids as $userId) {
                $user = User::find($userId);
                if (! $user) {
                    $failedIds[] = $userId;

                    continue;
                }

                if ($this->isProtectedCompanyUser($user)) {
                    DB::rollBack();

                    return response()->json(
                        [
                            'status' => 0,
                            'message' => 'You cannot delete your own account or the company owner account.',
                        ],
                        403
                    );
                }

                // Delete image if exists
                if ($user->image) {
                    ImageService::delete($user->getRawOriginal('profile_image'), 'user-images');
                }

                // Delete the user
                $user->delete();
            }

            if (! empty($failedIds)) {
                DB::rollBack();

                return response()->json(
                    [
                        'status' => 0,
                        'message' => 'Users not found: '.implode(', ', $failedIds),
                    ],
                    404
                );
            }

            DB::commit();

            return response()->json(
                [
                    'status' => 1,
                    'message' => 'Users deleted successfully',
                ],
                200
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(
                [
                    'status' => 0,
                    'message' => 'Failed to delete users',
                ],
                500
            );
        }
    }

    public function destroyMultiple(Request $request)
    {
        return $this->delete($request);
    }

    public function partnerList()
    {
        $company_list = Company::where('status', 1)->OrderBy('name', 'asc')->get();

        return response()->json([
            'status' => 1,
            'message' => 'Data retrive successful!',
            'partners' => $company_list,
        ], 200);
    }

    public function searchCustomers(Request $request)
    {
        $search_text = $request->input('params');
        $data = [];
        $companyId = Auth::user()?->company_id;

        if (! empty($search_text)) {
            $query = User::query()
                ->where('role', 2)
                ->when($companyId, fn ($q) => $q->where('company_id', $companyId), fn ($q) => $q->whereRaw('1 = 0'));

            $query->where(function ($q) use ($search_text) {
                $q->where('phone', 'like', '%'.$search_text.'%')
                    ->orWhere(DB::raw("CONCAT(first_name, ' ', COALESCE(last_name, '')) COLLATE utf8mb4_unicode_ci"), 'like', '%'.$search_text.'%');
            });

            $customers = $query->get();

            $data = $customers->map(function ($customer) {
                return [
                    'id' => $customer->id,
                    'name' => trim($customer->first_name.' '.$customer->last_name),
                    'phone' => $customer->phone,
                    'email' => $customer->email,
                    'address' => $customer->address,
                    'reward_points' => $customer->total_reword ?? 0,
                ];
            });
        }

        return response()->json([
            'status' => 1,
            'message' => 'Data retrive successful!',
            'data' => $data,
        ], 200);
    }

    public function customerStore(Request $request)
    {
        // Validate incoming request
        $validator = Validator::make($request->all(), [
            'name' => 'nullable|string|max:255',
            'email' => [
                'nullable',
                'email',
                Rule::unique('user', 'email')->where(function ($query) {
                    return $query->where('company_id', Auth::user()->company_id);
                }),
            ],
            'phone' => [
                'required',
                'max:20',
                Rule::unique('user', 'phone')->where(function ($query) {
                    return $query->where('company_id', Auth::user()->company_id);
                }),
            ],
            'address' => 'nullable',
        ]);

        // If validation fails, return error response
        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors(),
            ], 422);
        }

        // Begin database transaction
        DB::beginTransaction();

        try {
            // Create the user
            $user = new User;
            $user->first_name = $request->name;
            $user->last_name = $request->last_name;
            $user->email = $request->email ?? null;
            $user->phone = $request->phone;
            $user->address = $request->address ?? null;
            $user->role = 2;
            $user->status = 1;
            $user->company_id = Auth::user()->company_id;
            $user->password = Hash::make($request->password ?? $request->phone); // Fallback to phone if no password
            // If a profile image is provided, handle the upload
            if ($request->hasFile('thumbnail')) {
                $user->profile_image = ImageService::upload($request->file('thumbnail'), 'user-images', [
                    'extensions' => ['jpg', 'jpeg', 'png', 'gif'],
                    'mime_types' => ['image/jpeg', 'image/png', 'image/gif'],
                    'max_kb' => 2048,
                    'field' => 'thumbnail',
                ]);
            }
            $user->save();

            // Commit the transaction
            DB::commit();

            // Return success response
            return response()->json([
                'status' => 1,
                'message' => 'Customer created successfully',
                'data' => $user->toCustomerArray(),
            ], 200);
        } catch (\Exception $e) {
            // Rollback the transaction on error
            DB::rollBack();

            // Return error response
            return response()->json([
                'status' => 0,
                'message' => 'Failed to create customer',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function getDefaultCustomer()
    {
        $authUser = Auth::user();

        if (! $authUser || ! $authUser->company_id) {
            return response()->json([
                'status' => 1,
                'message' => 'No default customer available.',
                'data' => null,
            ], 200);
        }

        $user = User::query()
            ->where('role', 2)
            ->where('is_default', 1)
            ->where('company_id', $authUser->company_id)
            ->first();

        if (! $user) {
            $companyToken = preg_replace('/[^A-Za-z0-9]/', '', (string) $authUser->company_id);
            $companyToken = strtolower(substr($companyToken, 0, 12));
            $defaultEmail = "walking+{$companyToken}@example.invalid";
            $defaultPhone = '01'.str_pad((string) abs(crc32((string) $authUser->company_id)), 10, '0', STR_PAD_LEFT);
            $defaultPhone = substr($defaultPhone, 0, 12);

            $user = new User;
            $user->first_name = 'Walking';
            $user->last_name = 'Customer';
            $user->email = $defaultEmail;
            $user->phone = $defaultPhone;
            $user->role = 2;
            $user->status = 1;
            $user->is_default = 1;
            $user->company_id = $authUser->company_id;
            $user->password = Hash::make('12345678');
            $user->save();
        }

        return response()->json([
            'status' => 1,
            'message' => 'Data retrive successfully',
            'data' => $user->toCustomerArray(),
        ], 200);
    }
}
