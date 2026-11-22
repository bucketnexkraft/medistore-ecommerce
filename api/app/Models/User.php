<?php

namespace App\Models;

use App\Services\ImageService;
use App\Traits\BelongsToCompany;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use HasApiTokens, HasFactory, Notifiable, BelongsToCompany;

    public const ECOMMERCE_COMPANY_ROLE = 32;
    public const ECOMMERCE_USER_ROLE = 50;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $table = "user";
    protected $primaryKey = 'id';
    public $incrementing = false;

    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'google_id',
        'phone',
        'password',
        'private_code',
        'role',
        'is_super_admin',
        'status',
        'profile_image',
        'company_id',
        'wallet_balance',
        'private_code',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'private_code',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'is_super_admin' => 'boolean',
        'wallet_balance' => 'decimal:2',
    ];

    public function getProfileImageAttribute($value)
    {
        if (!empty($value)) {
            if (filter_var($value, FILTER_VALIDATE_URL)) {
                return $value;
            }

            return ImageService::url($value, 'user-images');
        }

        return $value;
    }

    // Add the following methods required by JWTSubject
    public function getJWTIdentifier()
    {
        return $this->getKey(); // Primary key (usually 'id')
    }

    public function getJWTCustomClaims()
    {
        return []; // Add custom claims if needed
    }
    
    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();
        static::creating(function ($model) {
            $model->id = substr(uniqid(), 0, 13).'-user-'.random_int(10000000000000000, 99999999999999999);
        });

        static::deleting(function ($user) {
            // User deletion should not delete company data
            // Company data should remain independent of user deletion
        });
    }

    public function roles(){
        return $this->belongsTo(Role::class, 'role', 'id');
    }

    public function company(){
        return $this->hasOne(Company::class, 'user_id', 'id');
    }

    public function currentCompany()
    {
        return $this->belongsTo(Company::class, 'company_id', 'company_id');
    }

    public function toCustomerArray()
    {
        return [
            'id' => $this->id,
            'name' => trim($this->first_name . ' ' . $this->last_name),
            'phone' => $this->phone,
            'email' => $this->email,
            'address' => $this->address,
            'is_default' => $this->is_default,
        ];
    }

    public function shifts()
    {
        return $this->hasMany(Timesheet::class, 'subject_user_id');
    }

    public function activeShift()
    {
        return $this->hasOne(Timesheet::class, 'subject_user_id')->whereNull('end_time');
    }

    public function receivedShifts()
    {
        return $this->hasMany(Timesheet::class, 'source_user_id');
    }

    public function handedOverShifts()
    {
        return $this->hasMany(Timesheet::class, 'source_user_id');
    }

    /**
     * Check if the user is a superadmin
     * Superadmin roles are defined here for easy modification
     */
    public function isSuperAdmin()
    {
        if ((int) ($this->is_super_admin ?? 0) === 1) {
            return true;
        }

        if (!in_array((int) $this->role, [1, 8], true)) {
            return false;
        }

        if (!empty($this->company_id)) {
            return false;
        }

        return true;
    }

    /**
     * Get the list of superadmin role IDs
     * This allows easy modification of superadmin roles
     */
    public static function getSuperAdminRoles()
    {
        return [1, 8];
    }

    public function resolveRoleName(): string
    {
        if ((int) $this->role === self::ECOMMERCE_COMPANY_ROLE) {
            return 'Store Owner';
        }

        if ((int) $this->role === self::ECOMMERCE_USER_ROLE) {
            return 'User';
        }

        return $this->roles?->name ?? 'No Role Assigned';
    }
}
