<?php

require __DIR__ . '/vendor/autoload.php';

$app = require __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$companyId = App\Models\Company::query()
    ->where('email', 'fafolikuli@mailinator.com')
    ->value('company_id');

$company = $companyId
    ? App\Models\Company::query()
        ->where('company_id', $companyId)
        ->select('company_id', 'email', 'domain', 'selected_e_template_id', 'storefront_homepage_builder')
        ->first()
    : null;

$pages = $companyId
    ? App\Models\StorefrontPage::query()
        ->where('company_id', $companyId)
        ->orderBy('created_at')
        ->get(['id', 'name', 'slug', 'route_mode', 'route_key'])
        ->toArray()
    : [];

$sections = $companyId
    ? App\Models\StorefrontSection::query()
        ->where('company_id', $companyId)
        ->orderBy('page_id')
        ->orderBy('order')
        ->get(['id', 'page_id', 'name', 'title', 'variant', 'layout', 'preset_key', 'component_key', 'order'])
        ->toArray()
    : [];

$actions = $companyId
    ? App\Models\StorefrontAction::query()
        ->where('company_id', $companyId)
        ->orderBy('created_at')
        ->get(['id', 'page_id', 'section_id', 'name', 'slug', 'placement', 'footer_group', 'link_type', 'route_key', 'expression'])
        ->toArray()
    : [];

$template = $company?->selected_e_template_id
    ? App\Models\ETemplate::query()->find($company->selected_e_template_id)
    : null;

echo json_encode([
    'company' => $company?->toArray(),
    'pages' => $pages,
    'sections' => $sections,
    'actions' => $actions,
    'template' => $template?->toArray(),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
