<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storefront_pages', function (Blueprint $table) {
            $table->string('route_mode', 40)->default('custom_url')->after('slug');
            $table->string('route_key', 160)->nullable()->after('route_mode');
        });

        DB::table('storefront_pages')
            ->get(['id', 'slug'])
            ->each(function ($page) {
                $slug = trim(strtolower((string) ($page->slug ?? '')));
                $routeKey = match ($slug) {
                    'home' => '/',
                    'products' => '/products',
                    'categories' => '/categories',
                    'deals' => '/deals',
                    'new-arrival' => '/new-arrival',
                    'limited-sale' => '/limited-sale',
                    'best-seller' => '/best-seller',
                    'group-purchase' => '/group-purchase',
                    'wishlist' => '/wishlist',
                    'cart' => '/cart',
                    'checkout' => '/checkout',
                    'checkout-one' => '/checkout-one',
                    'checkout-two' => '/checkout-two',
                    'track-order' => '/track-order',
                    'user-dashboard' => '/user-dashboard',
                    default => null,
                };

                DB::table('storefront_pages')
                    ->where('id', $page->id)
                    ->update([
                        'route_mode' => $routeKey ? 'internal_route' : 'custom_url',
                        'route_key' => $routeKey,
                    ]);
            });
    }

    public function down(): void
    {
        Schema::table('storefront_pages', function (Blueprint $table) {
            $table->dropColumn(['route_mode', 'route_key']);
        });
    }
};
