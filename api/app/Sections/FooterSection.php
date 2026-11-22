<?php

namespace App\Sections;

use App\Constant\Directory as Path;
use App\Models\Page;
use App\Sections\Fields\FileField;
use App\Sections\Fields\FooterLinksField;
use App\Sections\Fields\PageLinks;
use App\Sections\Fields\TextField;

/**
 * Class FooterSection
 *
 * Represents the footer section of the website.
 */
class FooterSection extends BaseSection
{
    protected string $name = 'footer';
    protected string $title = 'Footer Section';
    protected string $keyword = 'footer';
    protected bool $has_repeater = false;

    public function __construct()
    {
        parent::__construct($this->name);
    }

    public static function isFixed(): bool
    {
        return true;
    }

    public static function fields(): array
    {
        return [
            new FileField('content[bg_image]', 'Background Image', validation: ['content.bg_image' => imageValidation()]),
            new FooterLinksField('content[footer_group]', 'Footer Links Group', validation: ['content.footer_group' => 'nullable|array']),
            new PageLinks('content[page_links]', 'Terms & Conditions Link', validation: ['content.page_links' => 'required'], multiple: true),
            new TextField('content[newsletter_title]', 'Newsletter Title', validation: ['content.newsletter_title' => 'required']),
            new TextField('content[newsletter_text]', 'Newsletter Text', validation: ['content.newsletter_text' => 'required']),
        ];
    }

    public function render(): string
    {
        $footerGroups = collect($this->content['footer_group'] ?? [])
            ->filter(fn ($group) => !empty($group['title']) || !empty($group['links']))
            ->values()
            ->all();

        $policyPages = collect($this->content['page_links'] ?? [])
            ->map(function ($slug) {
                $page = Page::where('slug', $slug)->first();

                return $page ? ['slug' => $slug, 'name' => $page->name] : null;
            })
            ->filter()
            ->take(2)
            ->values();

        return view(theme() . 'sections.footer', [
            'section' => $this,
            'content' => $this->content,
            'newsletterTitle' => t($this->content['newsletter_title'] ?? 'Subscribe to our newsletter'),
            'newsletterPlaceholder' => t($this->content['newsletter_text'] ?? 'Enter your email'),
            'footerGroups' => $footerGroups,
            'footerBgImage' => !empty($this->content['bg_image'])
                ? get_file($this->content['bg_image'], Path::CMS_IMAGE_PATH)
                : asset('images/footer-bg.jpg'),
            'footerBrandLogo' => get_file(@settings('basic')->white_logo, Path::LOGO_PATH),
            'copyrightText' => settings('basic')->copyright ?? '',
            'footerBrandLabel' => @settings('basic')->sitename ?? 'Home',
            'policyPages' => $policyPages,
        ])->render();
    }
}
