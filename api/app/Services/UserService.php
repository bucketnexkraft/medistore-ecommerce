<?php

namespace App\Services;

use App\Models\Company;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class UserService
{
    /**
     * Create or update a user from backoffice company data
     */
    public static function createOrUpdateUserFromBackoffice($company, $companyData)
    {
        try {
            // Split contact_name into first_name and last_name
            $nameParts = explode(' ', trim($companyData['contact_name']));
            $firstName = $nameParts[0] ?? $companyData['contact_name'];
            $lastName = count($nameParts) > 1 ? implode(' ', array_slice($nameParts, 1)) : $firstName;
            
            Log::info('UserService: Creating/updating user for company', [
                'company_id' => $company->company_id,
                'company_user_id' => $company->user_id,
                'contact_name' => $companyData['contact_name'],
                'email' => $companyData['email'],
                'first_name' => $firstName,
                'last_name' => $lastName
            ]);
            
            $userData = [
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $companyData['email'],
                'phone' => $companyData['phone_number'],
                'role' => $companyData['role_id'] ?? 4,
                'status' => $companyData['status'],
                'company_id' => $company->company_id,
            ];

            if (!empty($companyData['password'])) {
                $userData['password'] = Hash::make($companyData['password']);
            }
            
            if ($company->user_id) {
                // Update existing user
                Log::info('UserService: Updating existing user', ['user_id' => $company->user_id]);
                $user = User::withoutGlobalScopes()->find($company->user_id);
                if ($user) {
                    $user->update(Arr::only($userData, [
                        'first_name',
                        'last_name',
                        'email',
                        'phone',
                        'role',
                        'status',
                        'company_id',
                        'password',
                    ]));
                    Log::info('UserService: User updated successfully', ['user_id' => $user->id]);
                    return $user;
                } else {
                    Log::warning('UserService: User not found for update', ['user_id' => $company->user_id]);
                }
            } else {
                // Create new user
                Log::info('UserService: Creating new user with data', [
                    'first_name' => $userData['first_name'],
                    'last_name' => $userData['last_name'],
                    'email' => $userData['email'],
                    'phone' => $userData['phone'],
                    'role' => $userData['role'],
                    'status' => $userData['status'],
                    'company_id' => $userData['company_id']
                ]);
                
                // Check if user with this email already exists
                $existingUser = User::withoutGlobalScopes()->where('email', $userData['email'])->first();
                if ($existingUser) {
                    Log::warning('UserService: User with this email already exists', [
                        'email' => $userData['email'],
                        'existing_user_id' => $existingUser->id
                    ]);
                    
                    $existingUser->update(Arr::only($userData, [
                        'first_name',
                        'last_name',
                        'email',
                        'phone',
                        'role',
                        'status',
                        'company_id',
                        'password',
                    ]));
                    $company->user_id = $existingUser->id;
                    if ($company->exists) {
                        $company->save();
                    }
                    
                    Log::info('UserService: Updated existing user with company_id', [
                        'user_id' => $existingUser->id,
                        'company_id' => $company->company_id
                    ]);
                    
                    return $existingUser;
                }
                
                if (!array_key_exists('password', $userData)) {
                    $userData['password'] = Hash::make(Str::random(16));
                }

                $user = User::create($userData);
                Log::info('UserService: User created successfully', ['user_id' => $user->id]);

                // Update company with the user_id
                $company->user_id = $user->id;
                if ($company->exists) {
                    $company->save();
                }

                Log::info('UserService: Company updated with user_id', [
                    'company_id' => $company->company_id,
                    'user_id' => $user->id
                ]);
                
                return $user;
            }
            
        } catch (\Exception $e) {
            Log::error('UserService: Failed to create/update user from backoffice: ' . $e->getMessage());
            Log::error('UserService: Exception details', [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }
    
    /**
     * Find user by company's user_id
     */
    public static function findUserById($companyId)
    {
        $company = Company::find($companyId);
        if ($company && $company->user_id) {
            return User::find($company->user_id);
        }
        return null;
    }
}
