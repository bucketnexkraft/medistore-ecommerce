<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Backoffice\LanguageController;
use App\Http\Controllers\Api\CustomerDashboardController;
use App\Http\Controllers\Api\CustomerOrderController;
use App\Http\Controllers\Api\Ecommerce\StorefrontAnalyticsController;
use App\Http\Controllers\Api\Ecommerce\StorefrontBlogController;
use App\Http\Controllers\Api\Ecommerce\StorefrontCatalogController;
use App\Http\Controllers\Api\Ecommerce\StorefrontEngagementController;
use App\Http\Controllers\Api\Ecommerce\StorefrontPageController;
use App\Http\Controllers\Api\Ecommerce\StorefrontSectionController;
use App\Http\Controllers\Api\Ecommerce\StorefrontSettingsController;
use App\Http\Controllers\Api\GroupPurchaseController;
use App\Http\Controllers\Api\PayoutRequestController;
use App\Http\Controllers\Api\PreferanceController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\WishlistController;
use Illuminate\Support\Facades\Route;

// Public authentication routes used by ecommerce
Route::middleware('throttle:auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/auth/admin-transfer/consume', [AuthController::class, 'consumeAdminTransferCode']);
    Route::post('/auth/landing-transfer/consume', [AuthController::class, 'consumeLandingTransferCode']);
    Route::post('/register', [AuthController::class, 'registerCustomer']);
    Route::get('/auth/google/redirect', [AuthController::class, 'googleRedirect']);
    Route::get('/auth/google/callback', [AuthController::class, 'googleCallback']);
    Route::post('/forgot-password/request', [AuthController::class, 'forgotPasswordRequest']);
    Route::post('/forgot-password/verify', [AuthController::class, 'forgotPasswordVerify']);
    Route::post('/forgot-password/reset', [AuthController::class, 'forgotPasswordReset']);
    Route::post('/register-company', [AuthController::class, 'registerCompany']);
});

// Public ecommerce routes
Route::get('/preferences', [PreferanceController::class, 'preferences']);
Route::get('/translations/{code?}', [LanguageController::class, 'getLanguageJson']);
Route::get('/translation-languages', [LanguageController::class, 'publicLanguages']);
Route::post('/translations/missing-key', [LanguageController::class, 'registerMissingKey']);
Route::get('/home', [StorefrontPageController::class, 'home']);
Route::post('/landing/analytics/events', [StorefrontAnalyticsController::class, 'store']);

Route::get('/landing/preferences', [StorefrontSettingsController::class, 'preferences']);
Route::get('/landing/social-auth', [StorefrontSettingsController::class, 'socialAuth']);

Route::get('/landing/settings', [StorefrontSettingsController::class, 'landingSettings']);
Route::get('/landing/settings/{key}', [StorefrontSettingsController::class, 'publicSetting']);
Route::get('/landing/currencies', [StorefrontSettingsController::class, 'landingCurrencies']);
Route::get('/landing/geo/locations', [PreferanceController::class, 'geoLocations']);
Route::get('/landing/checkout-settings', [CustomerOrderController::class, 'checkoutSettings']);
Route::get('/landing/payment-gateways', [CustomerOrderController::class, 'paymentGateways']);
Route::post('/landing/checkout-preview', [CustomerOrderController::class, 'preview']);
Route::post('/landing/orders/track', [CustomerOrderController::class, 'publicTrack']);
Route::post('/landing/orders', [CustomerOrderController::class, 'store']);
Route::match(['get', 'post'], '/landing/order-payments/{trx}/success', [CustomerOrderController::class, 'paymentSuccess']);
Route::match(['get', 'post'], '/landing/order-payments/{trx}/cancel', [CustomerOrderController::class, 'paymentCancel']);
Route::get('/landing/products/search', [ProductController::class, 'publicSearch']);
Route::get('/landing/products', [StorefrontCatalogController::class, 'landingProducts']);
Route::get('/landing/products/combination-data', [ProductController::class, 'fetchCombinationData']);
Route::get('/landing/products/{productId}/combinations', [ProductController::class, 'publicCombinations']);
Route::get('/landing/products/{slug}', [ProductController::class, 'publicDetails']);
Route::get('/landing/brands', [StorefrontCatalogController::class, 'landingBrands']);
Route::get('/landing/group-purchases', [GroupPurchaseController::class, 'publicIndex']);
Route::get('/group-purchases/invitations/{token}', [GroupPurchaseController::class, 'invitationDetails']);
Route::get('/landing/menu', [StorefrontCatalogController::class, 'landingMenu']);
Route::get('/landing/categories/mega-menu', [StorefrontCatalogController::class, 'landingMegaCategories']);
Route::get('/landing/categories', [StorefrontCatalogController::class, 'landingCategories']);
Route::get('/landing/categories/{slug}', [StorefrontCatalogController::class, 'landingCategoryDetails']);
Route::get('/landing/sections/hero', [StorefrontSectionController::class, 'landingHero']);
Route::get('/landing/sections/featured-products', [StorefrontSectionController::class, 'landingFeaturedProducts']);
Route::get('/landing/sections/hot-categories', [StorefrontSectionController::class, 'landingHotCategories']);
Route::get('/landing/sections/flash-deals', [StorefrontSectionController::class, 'landingFlashDeals']);
Route::get('/landing/sections/just-for-you', [StorefrontSectionController::class, 'landingJustForYou']);
Route::get('/landing/sections/footer', [StorefrontSectionController::class, 'landingFooter']);
Route::get('/landing/sections/pricing', [StorefrontSectionController::class, 'landingPricing']);
Route::get('/landing/sections/blog', [StorefrontBlogController::class, 'landingBlog']);
Route::get('/landing/blog-categories/{slug}', [StorefrontBlogController::class, 'landingBlogCategory']);
Route::get('/landing/blogs/{slug}', [StorefrontBlogController::class, 'landingBlogDetails']);
Route::post('/landing/contact', [StorefrontEngagementController::class, 'submitContact']);
Route::post('/landing/newsletter/subscribe', [StorefrontEngagementController::class, 'subscribeNewsletter']);
Route::get('/pages/{slug}', [StorefrontPageController::class, 'page']);

// Protected ecommerce routes
Route::middleware('auth:api')->group(function () {
    Route::post('/verify-token', [AuthController::class, 'verifyToken'])
        ->middleware('throttle:session');

    Route::middleware('throttle:auth')->group(function () {
        Route::post('/verify-route-access', [AuthController::class, 'verifyRouteAccess']);
        Route::post('/auth/landing-transfer', [AuthController::class, 'issueLandingTransferCode']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::get('/user/rights', [AuthController::class, 'getUserRights']);
        Route::post('/update/profile', [AuthController::class, 'updateProfile']);
        Route::post('/change/password', [AuthController::class, 'changePassword']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });

    Route::post('/auth/admin-transfer', [AuthController::class, 'issueAdminTransferCode'])
        ->middleware('throttle:sso');

    Route::get('/customer/dashboard', [CustomerDashboardController::class, 'index']);

    Route::controller(WishlistController::class)->group(function () {
        Route::get('/wishlists', 'index');
        Route::post('/wishlists', 'store');
        Route::delete('/wishlists/{productId}', 'destroy');
    });

    Route::controller(CustomerOrderController::class)->group(function () {
        Route::get('/customer/shipping-addresses', 'shippingAddresses');
        Route::post('/customer/shipping-addresses', 'storeShippingAddress');
        Route::put('/customer/shipping-addresses/{addressId}', 'updateShippingAddress');
        Route::delete('/customer/shipping-addresses/{addressId}', 'deleteShippingAddress');
        Route::get('/customer/orders', 'index');
        Route::get('/customer/orders/{orderId}/invoice', 'downloadInvoice');
        Route::post('/customer/orders/{orderId}/reviews', 'storeReview');
        Route::post('/customer/orders/{orderId}/items/{itemId}/return', 'storeReturnRequest');
        Route::post('/customer/orders', 'store');
    });

    Route::controller(PayoutRequestController::class)->group(function () {
        Route::get('/customer/payout-requests', 'customerIndex');
        Route::post('/customer/payout-requests', 'customerStore');
    });

    Route::controller(GroupPurchaseController::class)->group(function () {
        Route::get('/group-purchases/my', 'myGroups');
        Route::get('/group-purchases/{id}', 'show');
        Route::post('/group-purchases', 'store');
        Route::post('/group-purchases/{id}/join', 'join');
        Route::post('/group-purchases/invitations/{token}/join', 'joinByInvitation');
        Route::get('/group-purchases/{id}/messages', 'messages');
        Route::get('/group-purchases/{id}/stream', 'stream');
        Route::post('/group-purchases/{id}/messages', 'sendMessage');
    });
});
