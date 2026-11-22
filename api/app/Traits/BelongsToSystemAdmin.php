<?php 

namespace App\Traits;

use Illuminate\Support\Facades\Auth;

trait BelongsToSystemAdmin
{
    protected static function bootBelongsToSystemAdmin()
    {
        static::addGlobalScope('system_admin', function ($builder) {
            if (
                Auth::check() &&
                !Auth::user()->isSuperAdmin()
            ) {
                $builder->where('is_system_admin_only', 0);
            }
        });
    }
}
