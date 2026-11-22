<?php

namespace App\Sections;

use App\Sections\Fields\FileField;
use App\Sections\Fields\PageLinks;
use App\Sections\Fields\TextareaField;
use App\Sections\Fields\TextField;

/**
 * Represents the Hero section of a page.
 */
class HeroSection extends BaseSection
{
    // The name of this section.
    protected string $name = 'hero';
    // The title of this section.
    protected string $title = 'Hero Section';
    // The keyword used for this section.
    protected string $keyword = 'hero';
    // Indicates if this section has a repeater.
    protected bool $has_repeater = false;

    /**
     * Constructs a new HeroSection.
     */
    function __construct()
    {
        parent::__construct($this->name);
    }

    /**
     * Returns an array of fields for this section.
     *
     * @return array An array of Field objects.
     */
    public static function fields(): array
    {
        return [
            // Heading Field
            new TextField('content[heading]', 'Heading', validation: ['content.heading'=>'required']),
            // Hero Sub Heading Field
            new TextField('content[sub_heading]', 'Sub Heading', validation: ['content.sub_heading'=>'required']),
            // Hero Text Field
            new TextareaField('content[hero_text]', 'Banner Details Text', validation: ['content.hero_text'=>'required']),
            // Button Text Field
            new TextField('content[button_text_1]', 'Button Text one', validation: ['content.button_text_1'=>'required']),
            // page link Field
            new PageLinks('content[button_link_1]', 'Button Link one', validation: ['content.button_link_1'=>'required']),
            // Hero Tag Field
            new TextField('content[hero_tag1]', 'Hero Tag one', validation: ['content.hero_tag1']),
            // Hero Tag Field
            new TextField('content[hero_tag2]', 'Hero Tag two', validation: ['content.hero_tag2']),
            // Hero Image Field
            new FileField('content[hero-img]', 'Primary Image', col: 'col-lg-2', validation: ['content.hero-img'=> imageValidation()]),
            // Hero Background Image Field
            new FileField('content[hero-bg-1]', 'Background Image', col: 'col-lg-3', validation: ['content.hero-bg-1'=> imageValidation()]),
        ];
    }

    public function render(): string
    {
        return view(theme() . 'sections.hero', [
            'section' => $this,
            'content' => $this->content,
            'elements' => $this->element ?? [],
            'primaryButtonText' => t($this->content['button_text_1'] ?? 'GET STARTED'),
            'secondaryButtonText' => t($this->content['button_text_2'] ?? 'Watch Demo'),
            'primaryButtonLink' => $this->content['button_link_1'] ?? '#',
            'secondaryButtonLink' => $this->content['button_link_2'] ?? '#',
        ])->render();
    }

    /**
     * Indicates if this section is fixed.
     *
     * @return bool True if this section is fixed, false otherwise.
     */
    public static function isFixed(): bool
    {
        return true;
    }
}
