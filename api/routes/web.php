<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\FrontendController;
use App\Http\Controllers\OrderPaymentController;
use App\Http\Controllers\PlanPaymentController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', function () {
    return view('welcome'); // or your homepage view
})->name('home');

// SaaS plan payment gateway callbacks (current flow uses `plan-payment-*`).
Route::match(['get', 'post'], '/plan-payment-success/{trx}', [PlanPaymentController::class, 'paymentSuccess'])->name('plan-payment-success');
Route::match(['get', 'post'], '/plan-payment-cancel/{trx}', [PlanPaymentController::class, 'paymentCancel'])->name('plan-payment-cancel');

// Stripe confirms completed Checkout sessions here even when the customer closes
// the browser before returning to the application.
Route::post('/webhooks/stripe/{gateway}', [PlanPaymentController::class, 'stripeWebhook'])->name('stripe-webhook');

// Kit-compatible aliases (some gateways/flows use `payment-*` route names).
Route::match(['get', 'post'], '/payment-success/{trx}', [PlanPaymentController::class, 'paymentSuccess'])->name('payment-success');
Route::match(['get', 'post'], '/payment-cancel/{trx}', [PlanPaymentController::class, 'paymentCancel'])->name('payment-cancel');
Route::match(['get', 'post'], '/order-payment-success/{trx}', [OrderPaymentController::class, 'paymentSuccess'])->name('order-payment-success');
Route::match(['get', 'post'], '/order-payment-cancel/{trx}', [OrderPaymentController::class, 'paymentCancel'])->name('order-payment-cancel');

// Invoice download route
Route::get('/invoices/{id}/download', [App\Http\Controllers\Api\InvoiceController::class, 'download'])->name('invoices.download');

Route::post('/newsletter/subscribe', [FrontendController::class, 'subscribeNewsletter'])->name('newsletter.subscribe');

Route::get('/change-locale', [FrontendController::class, 'changeLocale'])->name('change-locale');

require __DIR__ . '/installer.php';
