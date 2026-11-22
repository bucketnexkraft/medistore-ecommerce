<?php

namespace App\Auth;

use Illuminate\Contracts\Auth\Factory as AuthFactory;
use Tymon\JWTAuth\Contracts\Providers\Auth;

class ApiJwtAuthProvider implements Auth
{
    private $guard;

    public function __construct(AuthFactory $auth)
    {
        $this->guard = $auth->guard('api');
    }

    public function byCredentials(array $credentials)
    {
        return $this->guard->once($credentials);
    }

    public function byId($id)
    {
        return $this->guard->onceUsingId($id);
    }

    public function user()
    {
        return $this->guard->user();
    }
}
