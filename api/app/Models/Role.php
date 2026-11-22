<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class Role extends Model
{
    use HasFactory, BelongsToCompany;
    protected $table = "role";

    protected $fillable = ['name', 'company_id'];

    protected static function boot()
    {
        parent::boot();
        static::bootBelongsToCompany();
        static::addGlobalScope('company', function ($builder) {
            if (Auth::check()) {
                $user = Auth::user();

                if (!$user->isSuperAdmin()) {
                    if($user->role == 4 && route('role-list-api') == url()->current()){
                        $builder->where('company_id', $user->company_id);
                    }elseif($user->role != 4){
                        $builder->where('company_id', $user->company_id);
                    }
                }
            }
        });
    }

    public function rights()
    {
        return $this->hasMany(RoleRight::class, 'role_id', 'id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id', 'company_id');
    }

    public function toRightArray()
    {
        return $this->rights->map(function ($right) {
            return [
                'module' => $right->right->module ?? null,
                'right' => $right->right->name ?? null,
                'permission' => ($right->permission == 1) ? 1 : 0,
            ];
        })->toArray();
    }
}
