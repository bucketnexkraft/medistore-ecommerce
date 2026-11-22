<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Company extends Model
{
    use HasFactory;

    protected $table = 'company';
    protected $primaryKey = 'company_id';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'user_id',
        'type',
        'name',
        'contact_name',
        'phone_number',
        'fax',
        'department',
        'vat_no',
        'reg_number',
        'tin_number',
        'bin_number',
        'email',
        'address',
        'post_code',
        'state',
        'city',
        'country',
        'website_url',
        'domain',
        'custom_domain',
        'custom_domain_verified_at',
        'discount_type',
        'discount',
        'website_logo',
        'site_favicon',
        'site_color',
        'currency_id',
        'language_id',
        'facebook_link',
        'twitter_link',
        'linkedin_link',
        'instagram_link',
        'youtube_link',
        'chat_support_channel',
        'facebook_page_id',
        'whatsapp_number',
        'gtm_id',
        'facebook_pixel_id',
        'facebook_pixel_access_token',
        'facebook_test_event_id',
        'tiktok_pixel_id',
        'tiktok_pixel_access_token',
        'tiktok_test_event_code',
        'delivery_channel_settings',
        'delivery_charge_settings',
        'courier_settings',
        'sms_service_provider',
        'sms_api_key',
        'sms_sender_id',
        'sms_template_settings',
        'payment_gateway_settings',
        'allow_guest_checkout',
        'sms_verify_phone_on_order',
        'push_status',
        'pusher_app_key',
        'pusher_app_cluster',
        'pusher_app_id',
        'pusher_app_secret',
        'google_client_id',
        'google_client_secret',
        'social_auth_enabled',
        'about_us',
        'terms_and_conditions',
        'privacy_policy',
        'return_policy',
        'storefront_homepage_builder',
        'status',
        'business_mode',
        'saas_plan_id',
        'ecommerce_category_id',
        'selected_e_template_id',
        'ecommerce_setup_completed_at',
        'plan_subscribed_at',
        'ancestor_id',
        'referral_code',
        'stockguard_unit_threshold',
        'stockguard_value_threshold',
        'stock_tracking_enabled',
    ];

    protected $casts = [
        'user_id' => 'string',
        'status' => 'integer',
        'business_mode' => 'string',
        'saas_plan_id' => 'integer',
        'ecommerce_category_id' => 'integer',
        'selected_e_template_id' => 'integer',
        'ecommerce_setup_completed_at' => 'datetime',
        'plan_subscribed_at' => 'datetime',
        'custom_domain_verified_at' => 'datetime',
        'discount' => 'decimal',
        'push_status' => 'boolean',
        'social_auth_enabled' => 'boolean',
        'delivery_channel_settings' => 'array',
        'delivery_charge_settings' => 'array',
        'courier_settings' => 'array',
        'sms_template_settings' => 'array',
        'payment_gateway_settings' => 'array',
        'allow_guest_checkout' => 'boolean',
        'sms_verify_phone_on_order' => 'boolean',
        'storefront_homepage_builder' => 'array',
        'stockguard_unit_threshold' => 'float',
        'stockguard_value_threshold' => 'float',
        'stock_tracking_enabled' => 'boolean',
    ];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            // Always generate if missing
            if (empty($model->company_id)) {
                $model->company_id = substr(uniqid(), 0, 13) . '-comp-' . random_int(10000000000000000, 99999999999999999);
            }

            if (empty($model->referral_code)) {
                do {
                    $model->referral_code = strtoupper(Str::random(8));
                } while (self::withoutGlobalScopes()
                    ->where('referral_code', $model->referral_code)
                    ->exists());
            }
        });
    }

    public function user(){
        return $this->belongsTo(User::class, 'user_id');
    }

    public function rewordSetup()
    {
        return $this->hasOne(RewordSetup::class, 'company_id', 'company_id');
    }

    public function currency(){
        return $this->belongsTo(Currency::class, 'currency_id', 'id');
    }

    public function featurePreferences()
    {
        return $this->hasMany(CompanyFeaturePreference::class, 'company_id', 'company_id');
    }

    public function referrerCompany()
    {
        return $this->belongsTo(self::class, 'ancestor_id', 'company_id');
    }

    public function referralChildren(): HasMany
    {
        return $this->hasMany(self::class, 'ancestor_id', 'company_id');
    }

    public function defaultCustomer()
    {
        return $this->hasOne(User::class, 'company_id', 'company_id');
    }

    public function posSetting()
    {
        return $this->hasOne(PosSetting::class, 'company_id', 'company_id');
    }

    public function warehouse()
    {
        return $this->hasOne(Warehouse::class, 'company_id', 'company_id');
    }

    public function saasPlan()
    {
        return $this->belongsTo(SaasPlan::class, 'saas_plan_id');
    }

    public function planPaymentLogs()
    {
        return $this->hasMany(PlanPaymentLog::class, 'company_id', 'company_id');
    }

    public function commissionCharges(): HasMany
    {
        return $this->hasMany(CompanyCommissionCharge::class, 'company_id', 'company_id');
    }

    public function commissionPaymentLogs(): HasMany
    {
        return $this->hasMany(CommissionPaymentLog::class, 'company_id', 'company_id');
    }

    public function referralEarnings(): HasMany
    {
        return $this->hasMany(CompanyReferralEarning::class, 'company_id', 'company_id');
    }

    public function storefrontPages()
    {
        return $this->hasMany(StorefrontPage::class, 'company_id', 'company_id');
    }

    public function storefrontSections()
    {
        return $this->hasMany(StorefrontSection::class, 'company_id', 'company_id');
    }

    public function storefrontActions()
    {
        return $this->hasMany(StorefrontAction::class, 'company_id', 'company_id');
    }

    public function ecommerceCategory()
    {
        return $this->belongsTo(ECategory::class, 'ecommerce_category_id');
    }

    public function selectedETemplate()
    {
        return $this->belongsTo(ETemplate::class, 'selected_e_template_id');
    }

    public function eTemplateAccesses()
    {
        return $this->hasMany(CompanyETemplateAccess::class, 'company_id', 'company_id');
    }
}
