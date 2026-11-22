<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register(): void
    {
        // Keep application helpers available even when a deployment reuses a stale Composer autoloader.
        require_once app_path('helpers.php');
    }

    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot(): void
    {
        $sectionFiles = glob(app_path('Sections/*Section.php')) ?: [];

        foreach ($sectionFiles as $file) {
            $class = 'App\\Sections\\' . pathinfo($file, PATHINFO_FILENAME);
            $alias = class_basename($class);

            if (class_exists($class) && !class_exists($alias, false)) {
                class_alias($class, $alias);
            }
        }
    }
}
