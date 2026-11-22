<?php

use App\Data\FeaturePreference;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\BrandController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DiscountSetupController;
use App\Http\Controllers\Api\EcommerceSetupController;
use App\Http\Controllers\Api\FeaturePreferenceController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\InventoryCopilotController;
use App\Http\Controllers\Api\LogViewerController;
use App\Http\Controllers\Api\PosSettingsController;
use App\Http\Controllers\Api\PreferanceController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProductBundleController;
use App\Http\Controllers\Api\ProductBarcodeStoreController;
use App\Http\Controllers\Api\PurchaseController;
use App\Http\Controllers\Api\RoleRightController;
use App\Http\Controllers\Api\SegmentController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\ProductVariantController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RewordSetupController;
use App\Http\Controllers\Api\StockController;
use App\Http\Controllers\Api\StockGuardController;
use App\Http\Controllers\Api\StockTransferController;
use App\Http\Controllers\Api\StorefrontHomeBuilderController;
use App\Http\Controllers\Api\TimesheetController;
use App\Http\Controllers\Api\UnitController;
use App\Http\Controllers\Api\UserDefinedValueController;
use App\Http\Controllers\Api\WarehouseController;
use App\Http\Controllers\Api\WaitlistController;
use App\Http\Controllers\Api\WorkSlotController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\Backoffice\BackofficeController;
use App\Http\Controllers\Api\Backoffice\CompanyController;
use App\Http\Controllers\Api\Backoffice\AdminSettingController;
use App\Http\Controllers\Api\Backoffice\ConfigurationController;
use App\Http\Controllers\Api\Backoffice\SettingsController;
use App\Http\Controllers\Api\Backoffice\EmailTemplateController;
use App\Http\Controllers\Api\Backoffice\GatewayController;
use App\Http\Controllers\Api\Backoffice\PlanPaymentLogController;
use App\Http\Controllers\Api\Backoffice\CommissionPaymentLogController;
use App\Http\Controllers\Api\Backoffice\ContentManagementController;
use App\Http\Controllers\Api\Backoffice\CurrencyController;
use App\Http\Controllers\Api\Backoffice\DashboardController as BackofficeDashboardController;
use App\Http\Controllers\Api\Backoffice\ECategoryController;
use App\Http\Controllers\Api\Backoffice\ESectionPresetController;
use App\Http\Controllers\Api\Backoffice\ETemplateController;
use App\Http\Controllers\Api\Backoffice\LanguageController;
use App\Http\Controllers\Api\Backoffice\LocationController;
use App\Http\Controllers\Api\Backoffice\BlogController;
use App\Http\Controllers\Api\Backoffice\BlogCategoryController;
use App\Http\Controllers\Api\Backoffice\ContactMessageController;
use App\Http\Controllers\Api\Backoffice\NewsletterController;
use App\Http\Controllers\Api\CompanyOrderController;
use App\Http\Controllers\Api\PayoutRequestController;
use App\Http\Controllers\Api\ReferralController;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

Route::prefix('v1')->group(function () {
    Route::get('/install-status', function () {
        $installed = File::exists(storage_path('installed'));

        return response()->json([
            'status' => $installed ? 1 : 0,
            'installed' => $installed,
            'code' => $installed ? null : 'BACKEND_NOT_INSTALLED',
            'message' => $installed ? 'Backend is installed.' : 'Backend is not installed yet.',
        ], $installed ? 200 : 503);
    });

    require base_path('routes/ecommerce.php');

Route::controller(EcommerceSetupController::class)->group(function () {
    Route::get('/storefront/ecommerce-setup/public-options', 'publicOptions');
    Route::get('/storefront/ecommerce-setup/public-premium-templates', 'publicPremiumTemplates');
    Route::get('/storefront/ecommerce-setup/public-preview-token', 'publicPreviewToken');
    Route::get('/storefront/ecommerce-setup/public-preview/{templateId}', 'publicPreview');
});

    Route::controller(\App\Http\Controllers\Api\SaasPlanController::class)->group(function () {
        Route::get('/public/plans', 'publicIndex');
        Route::get('/public/plans/gateways', 'publicGateways');
    });

    // Backoffice Routes
    Route::prefix('backoffice')
        ->middleware(['auth:api', 'throttle:api'])
        ->group(function () {
            Route::get('/dashboard', [BackofficeDashboardController::class, 'index']);
            Route::get('/feature-preferences', [BackofficeController::class, 'featurePreferenceOptions']);

            // Role Management
            Route::controller(\App\Http\Controllers\Api\Backoffice\RoleController::class)->group(function () {
                Route::get('/roles', 'index');
            });

            // Company Management
            Route::controller(CompanyController::class)->group(function () {
                Route::get('/companies', 'list');
                Route::get('/companies/{id}', 'show');
                Route::get('/companies/{id}/users', [BackofficeController::class, 'companyUsers']);
                Route::get('/companies/{id}/feature-preferences', [BackofficeController::class, 'companyFeaturePreferences']);
                Route::put('/companies/{id}/feature-preferences/sync', [BackofficeController::class, 'syncCompanyFeaturePreferences']);
                Route::post('/companies/{id}/feature-preferences', [BackofficeController::class, 'storeCompanyFeaturePreference']);
                Route::put('/companies/{id}/feature-preferences/{preferenceId}', [BackofficeController::class, 'updateCompanyFeaturePreference']);
                Route::delete('/companies/{id}/feature-preferences/{preferenceId}', [BackofficeController::class, 'deleteCompanyFeaturePreference']);
                Route::get('/companies/{id}/rights', [BackofficeController::class, 'companyRights']);
                Route::put('/companies/{id}/rights', [BackofficeController::class, 'updateCompanyRights']);
                Route::post('/companies/{id}/users/{userId}/impersonate', [BackofficeController::class, 'impersonateCompanyUser']);
                Route::post('/companies', 'store');
                Route::put('/companies/{id}', 'update');
                Route::get('/companies/{id}/domain-availability', 'checkDomainAvailability');
                Route::post('/companies/{id}/custom-domain/validate-store', 'validateCustomDomainStore');
                Route::post('/companies/{id}/custom-domain/connect', 'connectCustomDomain');
                Route::put('/companies/{id}/info', 'updateCompanyInfo');
                Route::delete('/companies/{id}', 'destroy');
                Route::put('/companies/{id}/status', 'updateStatus');
                Route::delete('/companies/multiple-delete', 'destroyMultiple');
                Route::post('/companies/status-update/multiple', 'updateStatusMultiple');
            });

            Route::controller(LanguageController::class)
                ->prefix('languages')
                ->group(function () {
                Route::get('/', 'index');
                Route::post('/', 'store');
                Route::put('/{id}', 'update');
                Route::post('/{id}', 'update');
                Route::delete('/{id}', 'destroy');
                Route::get('/template/en/download', 'downloadEnglishTemplate');
                Route::get('/{code}/download', 'downloadByCode');
                    Route::post('/upload-json', 'uploadJson');
                });

            // SaaS Plan Management (POS + Inventory)
            Route::controller(\App\Http\Controllers\Api\SaasPlanController::class)->group(function () {
                Route::get('/plans/options', 'options');
                Route::get('/plans', 'index');
                Route::post('/plans', 'store');
                Route::get('/plans/{id}', 'show');
                Route::put('/plans/{id}', 'update');
                Route::delete('/plans/{id}', 'destroy');
                Route::put('/plans/{id}/status', 'updateStatus');
                Route::put('/plans/{id}/default', 'updateDefault');
            });

            // Admin Settings
            Route::controller(AdminSettingController::class)->group(function () {
                Route::get('/admin-settings', 'index');
                Route::post('/admin-settings', 'update');
            });

            // Cofigurations
            Route::controller(ConfigurationController::class)->group(function () {
                Route::get('/cofigurations', 'index');
                Route::post('/cofigurations', 'update');
                Route::get('/configurations', 'index');
                Route::post('/configurations', 'update');
            });

            // Full Settings module migrated from legacy backoffice
            Route::controller(SettingsController::class)->group(function () {
                Route::get('/settings/sections', 'index');
                Route::post('/settings/email/test', 'sendTestMail');
                Route::get('/settings/{key}', 'show');
                Route::post('/settings/{key}', 'update');
            });

            Route::controller(EmailTemplateController::class)->group(function () {
                Route::get('/email-templates', 'index');
                Route::get('/email-templates/{id}', 'show');
                Route::put('/email-templates/{id}', 'update');
                Route::put('/email-templates/{id}/status', 'updateStatus');
            });

            // Gateway Management
            Route::controller(GatewayController::class)->group(function () {
                Route::get('/gateways', 'index');
                Route::get('/gateways/{id}', 'edit');
                Route::put('/gateways/{id}', 'update');
                Route::post('/gateways/{id}', 'update');
            });

            Route::controller(PlanPaymentLogController::class)->group(function () {
                Route::get('/plan-payment-logs', 'index');
                Route::put('/plan-payment-logs/{id}/status', 'updateStatus');
            });

            Route::controller(CommissionPaymentLogController::class)->group(function () {
                Route::get('/commission-payment-logs', 'index');
                Route::put('/commission-payment-logs/{id}/status', 'updateStatus');
                Route::post('/commission-payment-logs/{companyId}/warning', 'sendWarning');
                Route::post('/commission-payment-logs/{companyId}/disable-store', 'disableStore');
            });

            Route::controller(CurrencyController::class)->group(function () {
                Route::get('/currencies', 'index');
                Route::post('/currencies', 'store');
                Route::put('/currencies/{id}', 'update');
                Route::delete('/currencies/{id}', 'destroy');
            });

            Route::controller(LocationController::class)->group(function () {
                Route::get('/location-hierarchies', 'hierarchyIndex');
                Route::get('/location-hierarchies/options', 'hierarchyOptions');
                Route::post('/location-hierarchies', 'hierarchyStore');
                Route::put('/location-hierarchies/{id}', 'hierarchyUpdate');
                Route::delete('/location-hierarchies/{id}', 'hierarchyDestroy');

                Route::get('/locations', 'locationIndex');
                Route::get('/locations/options', 'locationOptions');
                Route::post('/locations', 'locationStore');
                Route::put('/locations/{id}', 'locationUpdate');
                Route::delete('/locations/{id}', 'locationDestroy');
            });

            Route::controller(ECategoryController::class)->group(function () {
                Route::get('/e-categories', 'index');
                Route::post('/e-categories', 'store');
                Route::put('/e-categories/{id}', 'update');
                Route::delete('/e-categories/{id}', 'destroy');
            });

            Route::controller(ETemplateController::class)->group(function () {
                Route::get('/e-templates/options', 'options');
                Route::get('/e-templates', 'index');
                Route::get('/e-templates/{id}', 'show');
                Route::get('/e-templates/{id}/builder', 'showBuilder');
                Route::post('/e-templates', 'store');
                Route::put('/e-templates/{id}', 'update');
                Route::put('/e-templates/{id}/builder', 'updateBuilder');
                Route::delete('/e-templates/{id}', 'destroy');
            });

            Route::controller(ESectionPresetController::class)->group(function () {
                Route::get('/e-section-presets/options', 'options');
                Route::get('/e-section-presets', 'index');
                Route::post('/e-section-presets', 'store');
                Route::put('/e-section-presets/{id}', 'update');
                Route::post('/e-section-presets/{id}', 'update');
                Route::delete('/e-section-presets/{id}', 'destroy');
            });

            Route::controller(ContentManagementController::class)
                ->prefix('content')
                ->group(function () {
                    Route::get('/pages', 'pages');
                    Route::post('/pages', 'storePage');
                    Route::get('/pages/{id}', 'showPage');
                    Route::put('/pages/{id}', 'updatePage');
                    Route::delete('/pages/{id}', 'deletePage');
                    Route::put('/pages/{id}/sections', 'syncPageSections');
                    Route::get('/section-library', 'sectionLibrary');
                    Route::put('/sections/{name}', 'updateSectionContent');

                    Route::get('/menus', 'menuItems');
                    Route::post('/menus', 'storeMenuItem');
                    Route::put('/menus/{id}', 'updateMenuItem');
                    Route::post('/menus/sort', 'sortMenu');
                    Route::delete('/menus/{id}', 'deleteMenuItem');
                });

            Route::controller(BlogCategoryController::class)
                ->prefix('content/blog-categories')
                ->group(function () {
                    Route::get('/', 'index');
                    Route::post('/', 'store');
                    Route::put('/{id}', 'update');
                    Route::delete('/{id}', 'destroy');
                });

            Route::controller(BlogController::class)
                ->prefix('content/blogs')
                ->group(function () {
                    Route::get('/options', 'options');
                    Route::get('/', 'index');
                    Route::get('/{id}', 'show');
                    Route::post('/', 'store');
                    Route::put('/{id}', 'update');
                    Route::delete('/{id}', 'destroy');
                });

            Route::controller(ContactMessageController::class)
                ->prefix('content/contact-messages')
                ->group(function () {
                    Route::get('/', 'index');
                    Route::get('/{id}', 'show');
                    Route::delete('/{id}', 'destroy');
                });

            Route::controller(NewsletterController::class)
                ->prefix('content/newsletters')
                ->group(function () {
                    Route::get('/', 'index');
                    Route::post('/{id}/send-email', 'sendEmail');
                    Route::delete('/{id}', 'destroy');
                });
        });

    // Protected routes
    Route::middleware(['auth:api', 'throttle:api'])->group(function () {
        Route::get('/plans/available', [\App\Http\Controllers\Api\SaasPlanController::class, 'availableForCompany']);
        Route::get('/plans/gateways', [\App\Http\Controllers\Api\SaasPlanController::class, 'availableGatewaysForCompany']);
        Route::post('/plans/select', [\App\Http\Controllers\Api\SaasPlanController::class, 'selectForCompany']);
        Route::get('/plans/payments', [\App\Http\Controllers\Api\SaasPlanController::class, 'companyPaymentOverview']);
        Route::get('/plans/payment-checkout/{id}', [\App\Http\Controllers\Api\SaasPlanController::class, 'paymentCheckoutInfo']);
        Route::get('/templates/checkout/{templateId}', [\App\Http\Controllers\Api\SaasPlanController::class, 'templateCheckoutOptions']);
        Route::post('/templates/purchase', [\App\Http\Controllers\Api\SaasPlanController::class, 'templatePurchase']);
        Route::get('/commission/overview', [\App\Http\Controllers\Api\CommissionSubscriptionController::class, 'companyOverview']);
        Route::get('/commission/gateways', [\App\Http\Controllers\Api\CommissionSubscriptionController::class, 'companyGateways']);
        Route::post('/commission/payments', [\App\Http\Controllers\Api\CommissionSubscriptionController::class, 'companySubmitPayment']);
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllRead']);
        Route::get('/get-custom-data', [PreferanceController::class, 'customData']);
        Route::get('/get-company-preferences', [PreferanceController::class, 'getCompanyPreferences']);
        Route::post('/update-preferences', [PreferanceController::class, 'updatePreferences']);
        Route::post('/update-company-preferences', [PreferanceController::class, 'updateCompanyPreferences']);
        Route::post('/company-preferences/test-sms', [PreferanceController::class, 'sendTestSms']);
        Route::post('/company-preferences/test-pathao-courier', [PreferanceController::class, 'sendTestPathaoCourier']);
        Route::get('/get-currency', [PreferanceController::class, 'getCurrency']);
        Route::get('/geo/locations', [PreferanceController::class, 'geoLocations']);
        Route::controller(StorefrontHomeBuilderController::class)->group(function () {
            Route::get('/storefront/home-builder', 'show');
            Route::put('/storefront/home-builder', 'update');
            Route::post('/storefront/home-builder/media', 'uploadMedia');
        });
        Route::controller(EcommerceSetupController::class)->group(function () {
            Route::get('/storefront/ecommerce-setup', 'show');
            Route::get('/storefront/ecommerce-setup/post-payment-options', 'postPaymentOptions');
            Route::post('/storefront/ecommerce-setup/apply-template', 'applyTemplate');
        });

        Route::get('/dashboard', [DashboardController::class, 'index']);
        Route::get('/dashboard/details', [DashboardController::class, 'details']);
        Route::get('/inventory-copilot/insights', [InventoryCopilotController::class, 'insights']);
        Route::get('/inventory-copilot/settings', [InventoryCopilotController::class, 'settings']);
        Route::put('/inventory-copilot/settings', [InventoryCopilotController::class, 'updateSettings']);

        Route::controller(UserController::class)->group(function () {
            Route::get('/users', 'list');
            Route::post('/user/store', 'store');
            Route::any('/user/update/{id}', 'update');
            Route::get('/partner-list', 'partnerList');
            Route::get('/search/customers', 'searchCustomers');
            Route::post('/customer/store', 'customerStore');
            Route::put('/user/status', 'updateStatus');
            Route::delete('/user/delete/{id}', 'delete');
            Route::delete('/user/multiple-delete', 'destroyMultiple');
            Route::get('/get/default/customer', 'getDefaultCustomer');
        });

        Route::controller(FeaturePreferenceController::class)->group(function () {
            Route::get('/feature-preferences', 'index');
            Route::put('/feature-preferences/groups/{group}', 'updateGroup');
            Route::put('/feature-preferences/{code}', 'update');
        });

        Route::controller(UserDefinedValueController::class)->group(function () {
            Route::get('/user-defined-values', 'list');
            Route::post('/user-defined-values', 'store');
            Route::put('/user-defined-values/{id}', 'update');
            Route::delete('/user-defined-values/{id}', 'delete');
        });

        // category
        Route::controller(CategoryController::class)->group(function () {
            Route::get('/categories', 'list');
            Route::post('/category/store', 'store');
            Route::any('/category/update/{id}', 'update');
            Route::delete('/category/delete/{id}', 'delete');
            Route::any('/category/update-status/{id}', 'updateStatus');
            Route::post('/category/status-update/multiple', 'updateStatusMultiple');
            Route::delete('/category/multiple-delete', 'destroyMultiple');
        });

        // Brand
        Route::controller(BrandController::class)->group(function () {
            Route::get('/brands', 'list');
            Route::post('/brand/store', 'store');
            Route::any('/brand/update/{id}', 'update');
            Route::delete('/brand/delete/{id}', 'delete');
            Route::any('/brand/update-status/{id}', 'updateStatus');
            Route::post('/brand/status-update/multiple', 'updateStatusMultiple');
            Route::delete('/brand/multiple-delete', 'destroyMultiple');
        });

        // Unit
        Route::controller(UnitController::class)->middleware('feature.access:' . FeaturePreference::UNIT_SETUP->value)->group(function () {
            Route::get('/units', 'list');
            Route::post('/unit/store', 'store');
            Route::any('/unit/update/{id}', 'update');
            Route::delete('/unit/delete/{id}', 'delete');
            Route::any('/unit/update-status/{id}', 'updateStatus');
            Route::post('/unit/status-update/multiple', 'updateStatusMultiple');
            Route::delete('/unit/multiple-delete', 'destroyMultiple');
        });

        // Products
        Route::controller(ProductController::class)->group(function () {
            Route::get('/products', 'list');
            Route::get('/get-all-products', 'getAllProduct');
            Route::post('/product/store', 'store');
            Route::any('/product/update/{id}', 'update');
            Route::post('/product/generate-description', 'generateDescription')->middleware('feature.access:' . FeaturePreference::AI->value);
            Route::delete('/product/delete/{id}', 'delete');
            Route::get('/product/details/{id}', 'details');
            Route::get('/product/search', 'search');
            Route::get('/product/options', 'getProductOptions');
            Route::get('/product/variant-attributes', 'getVariantAttributes');
            Route::get('/product_stock_groups/{stock_group}', 'getStockGroup');
            Route::get('/fetch-combination-data', 'fetchCombinationData');
            Route::put('/product/status', 'updateStatus');
            Route::delete('/product/multiple-delete', 'destroyMultiple');
        });

        Route::controller(ProductBundleController::class)->middleware('feature.access:' . FeaturePreference::BUNDLE_PRODUCT->value)->group(function () {
            Route::get('/bundles', 'index');
            Route::post('/bundles', 'store');
            Route::get('/bundles/{id}', 'show');
            Route::put('/bundles/{id}', 'update');
            Route::delete('/bundles/{id}', 'destroy');
            Route::get('/bundles/{id}/price-preview', 'pricePreview');
        });

        // Suppler
        Route::controller(SupplierController::class)->group(function () {
            Route::get('/suppliers', 'list');
            Route::post('/supplier/store', 'store');
            Route::any('/supplier/update/{id}', 'update');
            Route::delete('/supplier/delete/{id}', 'delete');
            Route::put('/supplier/status', 'updateStatus');
            Route::delete('/supplier/multiple-delete', 'destroyMultiple');
        });

        // Purchase
        Route::controller(PurchaseController::class)->group(function () {
            Route::get('/purchases', 'list');
            Route::get('/purchase-returns', 'purchaseReturnList')->middleware('feature.access:' . FeaturePreference::PURCHASE_RETURN->value);
            Route::get('/purchases/create', 'create');
            Route::get('/sales-channels', 'salesChannels');
            Route::post('/purchase/store', 'store');
            Route::post('/purchase-return/store', 'storePurchaseReturn')->middleware('feature.access:' . FeaturePreference::PURCHASE_RETURN->value);
            Route::post('/purchase-return/{id}/payment', 'addPurchaseReturnPayment')->middleware('feature.access:' . FeaturePreference::PURCHASE_RETURN->value);
            Route::any('/purchase/update/{id}', 'update');
            Route::delete('/purchase/delete/{id}', 'delete');
            Route::get('get-invoice/{invoice?}', 'getInvoice');
            Route::post('store-invoice/{invoice}', 'storeInvoice');
            Route::get('/product-combinations/{productId}', 'getProductCombinations');
            Route::get('/stock/overview', 'stockOverview');
            Route::get('/inventory/check', 'inventoryCheck');
            Route::post('/purchases/update-quantity', 'updateQuantity');
            Route::post('/purchases/update-barcodes', 'updateBarcodes');
            Route::get('/stock-in-list', 'stockInList');
        });

        // Sales
        Route::controller(InvoiceController::class)->group(function () {
            Route::get('/sales', 'list');
            Route::get('/sales/drafts', 'draftsList');
            Route::post('/sale/store', 'store');
            Route::any('/sale/update/{id}', 'update');
            Route::delete('/sale/delete/{id}', 'delete');
            Route::delete('/sale/bulk/delete', 'destroyMultiple');
            Route::post('/invoice-items/return', 'invoiceItemReturn')->middleware('feature.access:' . FeaturePreference::SELL_RETURN->value);
            Route::get('/sales/{invoiceId}/return-preview', 'returnPreview')->middleware('feature.access:' . FeaturePreference::SELL_RETURN->value);
            Route::post('/sales/{invoiceId}/return', 'returnStore')->middleware('feature.access:' . FeaturePreference::SELL_RETURN->value);
            Route::post('/sales-returns/{salesReturnId}/approve', 'approveSalesReturn')->middleware('feature.access:' . FeaturePreference::SELL_RETURN->value);
            Route::get('/reports/sales-returns/daily', 'dailySellReturnReport')->middleware('feature.access:' . FeaturePreference::SELL_RETURN->value);
            Route::get('/reports/sales-returns/product-wise', 'productWiseReturnReport')->middleware('feature.access:' . FeaturePreference::SELL_RETURN->value);
            Route::get('/reports/sales-returns/customer-wise', 'customerWiseReturnReport')->middleware('feature.access:' . FeaturePreference::SELL_RETURN->value);
            Route::get('/reports/sales-returns/cashier-wise', 'cashierWiseReturnReport')->middleware('feature.access:' . FeaturePreference::SELL_RETURN->value);
            Route::get('/reports/sales-returns/damaged', 'damagedReturnReport')->middleware('feature.access:' . FeaturePreference::SELL_RETURN->value);
            Route::get('/reports/sales-returns/net-sales', 'netSalesAfterReturnReport')->middleware('feature.access:' . FeaturePreference::SELL_RETURN->value);
            Route::get('/reports/sales-returns/logs', 'sellReturnLogs')->middleware('feature.access:' . FeaturePreference::SELL_RETURN->value);
            Route::post('/invoices/{schedule_id}/pay', 'payInstallment');
            Route::post('/invoices/{id}/pay-direct', 'payInvoiceDue');
            Route::any('/verify/coupon-or-gift-card', 'verifyCouponOrGiftCard');
            Route::post('/invoices/{id}/send-email', 'sendEmail');
        });

        // Stock
        Route::controller(StockController::class)->group(function () {
            Route::get('/stock/out', 'stockoutList');
            Route::get('/stock/movements', 'movements');
        });

        Route::controller(StockGuardController::class)->group(function () {
            Route::get('/stockguard/options', 'options');
            Route::put('/stockguard/rules', 'updateRules');
            Route::get('/stockguard/requests', 'index');
            Route::post('/stockguard/requests', 'store');
            Route::post('/stockguard/requests/{id}/approve', 'approve');
            Route::post('/stockguard/requests/{id}/reject', 'reject');
        });

        Route::controller(StockTransferController::class)->middleware('feature.access:' . FeaturePreference::WAREHOUSE_STOCK_TRANSFER->value)->group(function () {
            Route::get('/stock-transfers', 'index');
            Route::get('/stock-transfers/source-items', 'sourceItems');
            Route::post('/stock-transfers', 'store');
            Route::get('/report/stock-transfer', 'report');
        });

        Route::controller(ProductBarcodeStoreController::class)->middleware('feature.access:' . FeaturePreference::PRODUCT_BARCODE->value)->group(function () {
            Route::get('/barcode-store', 'list');
            Route::post('/barcode-store', 'store');
            Route::any('/barcode-store/update/{id}', 'update');
            Route::delete('/barcode-store/delete/{id}', 'delete');
            Route::delete('/barcode-store/multiple-delete', 'destroyMultiple');
        });

        Route::controller(WaitlistController::class)->middleware('feature.access:' . FeaturePreference::CUSTOMER_WAITLIST->value)->group(function () {
            Route::get('/waitlists', 'index');
            Route::post('/waitlists', 'store');
            Route::get('/waitlists/{id}', 'show');
            Route::post('/waitlists/{id}/claim', 'claim');
            Route::post('/waitlists/{id}/release', 'release');
            Route::post('/waitlists/{id}/cancel', 'cancel');
        });

        Route::controller(CompanyOrderController::class)->group(function () {
            Route::post('/company/orders', 'store');
            Route::get('/company/orders', 'index');
            Route::get('/company/orders/track/by-number', 'trackByOrderNumber');
            Route::get('/company/orders/{id}', 'show');
            Route::put('/company/orders/{id}/status', 'updateStatus');
            Route::post('/company/orders/{id}/dispatch/pathao', 'dispatchToPathao');
            Route::get('/company/returns', 'returnRequests');
            Route::put('/company/returns/{id}/approve', 'approveReturnRequest');
            Route::put('/company/returns/{id}/reject', 'rejectReturnRequest');
        });

        Route::controller(PayoutRequestController::class)->group(function () {
            Route::get('/company/payout-requests', 'companyIndex');
            Route::put('/company/payout-requests/{id}/approve', 'companyApprove');
            Route::put('/company/payout-requests/{id}/reject', 'companyReject');
            Route::get('/referrals/payout-requests', 'referralIndex')
                ->middleware('feature.access:' . FeaturePreference::REFERRAL_SYSTEM->value);
            Route::post('/referrals/payout-requests', 'referralStore')
                ->middleware('feature.access:' . FeaturePreference::REFERRAL_SYSTEM->value);
        });

        Route::controller(ReferralController::class)
            ->middleware('feature.access:' . FeaturePreference::REFERRAL_SYSTEM->value)
            ->group(function () {
                Route::get('/referrals/dashboard', 'dashboard');
            });

        // Product Variants
        Route::controller(ProductVariantController::class)->group(function () {
            Route::get('product-variants', 'list');
            Route::post('product-variant/store', 'store');
            Route::any('product-variant/update/{id}', 'update');
            Route::delete('product-variant/delete/{id}', 'delete');
            Route::delete('/product-variant/multiple-delete', 'destroyMultiple');
            Route::put('variants/status', 'updateStatus');
        });

        Route::controller(WarehouseController::class)->group(function () {
            Route::get('warehouses', 'index');
            Route::post('warehouses/store', 'store');
            Route::any('warehouses/update/{id}', 'update');
            Route::delete('/warehouses/{id}', 'destroy');
            Route::delete('/warehouses', 'destroy');
        });

        Route::controller(SegmentController::class)->group(function () {
            Route::get('/segments', 'list');
            Route::post('/segment/store', 'store');
            Route::any('/segment/update/{id}', 'update');
            Route::delete('/segment/delete/{id}', 'delete');
        });

        Route::controller(ReportController::class)->group(function () {
            Route::get('/daily/monthly/sale/report', 'dailyMonthlySalesReport');
            Route::get('/daily/monthly/purchase/report', 'dailyMonthlyPurchaseReport');
            Route::get('/supplier/purchase/report', 'supplierPurchaseReport');
            Route::get('/categorywise/stock/report', 'categoryWiseStockReport');
            Route::get('/categorywise/sale/report', 'categoryWiseSalesReport');
            Route::get('/expire/product/report', 'expireProductReport');
            Route::get('/profit/margin/report', 'profitMarginReport');
            Route::get('/accounting/report', 'accountingReport');
            Route::get('/due/payments', 'duePaymentsList');
            Route::get('/accounts/report', 'accountsReport');
            Route::get('/product-ledger', 'productLedger');
            Route::get('/timesheet/report', 'timesheetReport');
            Route::get('/timesheet/cashiers', 'cashiers');
            Route::post('/verify-product-return', 'verifyProductReturn');
        });

        Route::controller(RewordSetupController::class)->group(function () {
            Route::post('/reword-setup/store', 'store');
            Route::any('/reword-setup/update/{id}', 'update');
            Route::get('/reword-setup/single/{id?}', 'getSingleSetup');
            Route::get('/reword-setup/list', 'list');
            Route::delete('/reword-setup/delete/{ids?}', 'delete');
        });

        // discount
        Route::controller(DiscountSetupController::class)->group(function () {
            Route::get('/discounts-setup/list', 'list');
            Route::post('/discounts-setup/store', 'store');
            Route::get('/discounts-setup/single/{id}', 'singleSetup');
            Route::any('/discounts-setup/update/{id}', 'update');
            Route::delete('/discounts-setup/delete/{id}', 'delete');
            Route::any('/discounts-setup/update-status/{id}', 'updateStatus');
            Route::post('/discounts-setup/status-update/multiple', 'updateStatusMultiple');
        });

        // Role & Right Management
        Route::controller(RoleRightController::class)->group(function () {
            Route::get('/role-right-permissions', 'list');
            Route::get('/role-list', 'roleList')->name('role-list-api');
            Route::post('/role-store', 'store');
            Route::any('/role-update/{id}', 'update');
            Route::delete('/role-delete/{id}', 'delete');

            Route::get('/right-list', 'rightList');
            Route::post('/right-store', 'rightStore');
            Route::any('/right-update/{id}', 'rightUpdate');
            Route::delete('/right-delete/{id}', 'rightDelete');
        });

        // POS Settings
        Route::controller(PosSettingsController::class)->group(function () {
            Route::get('/pos/settings', 'getSettings');
            Route::post('/pos/settings/update', 'updateSettings');
        });

        Route::controller(TimesheetController::class)->middleware('feature.access:' . FeaturePreference::SHIFT_AND_CASH_HANDOVER->value)->group(function () {
            Route::post('/timesheet/start', 'startShift');
            Route::post('/timesheet/handover', 'handoverShift');
            Route::post('/timesheet/cash-handover', 'cashHandover');
            Route::get('/timesheet/current', 'currentShift');
            Route::get('/timesheet/close-summary', 'closeSummary');
            Route::get('/timesheet/users', 'getUsers');
        });

        Route::controller(WorkSlotController::class)->group(function () {
            Route::get('/work-slots', 'index');
            Route::post('/work-slots', 'store');
            Route::put('/work-slots/{id}', 'update');
            Route::delete('/work-slots/{ids}', 'delete');
        });

        Route::controller(LogViewerController::class)->group(function () {
            Route::get('/logs', 'index');
            Route::get('/logs/{filename}', 'show');
            Route::get('/logs/{filename}/download', 'download');
            Route::delete('/logs/{filename}', 'destroy');
        });

        Route::controller(AuditLogController::class)->group(function () {
            Route::get('/audit-logs', 'index');
            Route::get('/audit-logs/{id}', 'show');
        });

    });
});
