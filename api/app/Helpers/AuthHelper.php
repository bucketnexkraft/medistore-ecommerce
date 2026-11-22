<?php

namespace App\Helpers;

use App\Models\User;

class AuthHelper
{
    /**
     * Check if the current authenticated user is a superadmin
     */
    public static function isSuperAdmin()
    {
        return auth()->check() && auth()->user()->isSuperAdmin();
    }

    /**
     * Get the list of superadmin role IDs
     */
    public static function getSuperAdminRoles()
    {
        return User::getSuperAdminRoles();
    }
}
