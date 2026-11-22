<?php

namespace App\Sections;

use App\Sections\Fields\PageLinks;
use App\Sections\Fields\TextField;
use App\Sections\Fields\TextareaField;

class EcommerceSetupSection extends BaseSection
{
    protected string $name = 'ecommerce_setup';
    protected string $title = 'Ecommerce Setup Section';
    protected string $keyword = 'ecommerce_setup';
    protected bool $has_repeater = true;

    public function __construct()
    {
        parent::__construct($this->name);
    }

    public static function fields(): array
    {
        return [
            new TextField('content[badge_text]', 'Badge Text', validation: ['content.badge_text' => 'required']),
            new TextField('content[sec_title]', 'Section Title', validation: ['content.sec_title' => 'required']),
            new TextareaField('content[sec_text]', 'Section Description', validation: ['content.sec_text' => 'required']),
            new TextField('content[primary_button_text]', 'Primary Button Text', validation: ['content.primary_button_text' => 'required']),
            new PageLinks('content[primary_button_link]', 'Primary Button Link', validation: ['content.primary_button_link' => 'required']),
            new TextField('content[secondary_button_text]', 'Secondary Button Text', validation: ['content.secondary_button_text']),
            new PageLinks('content[secondary_button_link]', 'Secondary Button Link', validation: ['content.secondary_button_link']),
        ];
    }

    public static function repeatedFields(): array
    {
        return [
            new TextField('content[0][step_number]', 'Step Number', validation: ['content.*.step_number' => 'required']),
            new TextField('content[0][step_title]', 'Step Title', validation: ['content.*.step_title' => 'required']),
            new TextareaField('content[0][step_text]', 'Step Description', validation: ['content.*.step_text' => 'required']),
        ];
    }

    public function render(): string
    {
        return view(theme() . 'sections.ecommerce_setup', [
            'section' => $this,
            'content' => $this->content,
            'elements' => $this->element ?? [],
        ])->render();
    }
}
