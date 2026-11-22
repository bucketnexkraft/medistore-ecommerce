<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

class RouteServiceProvider extends ServiceProvider
{
    /**
     * The path to the "home" route for your application.
     *
     * This is used by Laravel authentication to redirect users after login.
     *
     * @var string
     */
    public const HOME = '/home';

    /**
     * The controller namespace for the application.
     *
     * When present, controller route declarations will automatically be prefixed with this namespace.
     *
     * @var string|null
     */
    // protected $namespace = 'App\\Http\\Controllers';

    /**
     * Define your route model bindings, pattern filters, etc.
     *
     * @return void
     */
    public function boot(): void
    {
        $this->configureRateLimiting();

        $this->routes(function () {
            Route::prefix('api')
                ->middleware('api')
                ->namespace($this->namespace)
                ->group(base_path('routes/api.php'));

            Route::middleware('web')
                ->namespace($this->namespace)
                ->group(base_path('routes/web.php'));
        });
    }

    /**
     * Configure the rate limiters for the application.
     *
     * @return void
     */
    protected function configureRateLimiting(): void
    {
        RateLimiter::for('api', function (Request $request) {
            $identity = optional($request->user())->id;

            if (! $identity && $request->bearerToken()) {
                $identity = 'token:' . sha1((string) $request->bearerToken());
            }

            return Limit::perMinute(240)->by($identity ?: $request->ip());
        });

        RateLimiter::for('auth', function (Request $request) {
            $identity = Str::lower((string) (
                $request->input('email')
                ?: $request->input('username')
                ?: $request->input('phone')
                ?: optional($request->user())->id
                ?: 'guest'
            ));

            return Limit::perMinute(10)->by($identity . '|' . $request->ip());
        });

        RateLimiter::for('sso', function (Request $request) {
            $identity = optional($request->user())->id;

            if (! $identity && $request->bearerToken()) {
                $identity = 'token:' . sha1((string) $request->bearerToken());
            }

            return Limit::perMinute(60)->by($identity ?: $request->ip());
        });

        RateLimiter::for('session', function (Request $request) {
            $identity = optional($request->user())->id;

            if (! $identity && $request->bearerToken()) {
                $identity = 'token:' . sha1((string) $request->bearerToken());
            }

            return Limit::perMinute(120)->by($identity ?: $request->ip());
        });
    }
}
