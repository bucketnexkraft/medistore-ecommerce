<?php

namespace App\Sections;

use App\Sections\Fields\FileField;
use App\Sections\Fields\TextField;

/**
 * Class CorePrinciplesSection
 *
 * Represents the about section of the website.
 *
 * @package App\Sections
 */
class CorePrinciplesSection extends BaseSection
{
    protected string $name = 'core_principles';
    protected string $title = 'Core Principles Section';
    protected string $keyword = 'core_principles';
    protected bool $has_repeater = true;

    /**
     * CorePrinciplesSection constructor.
     *
     * Initializes a new instance of the CorePrinciplesSection class.
     */
    function __construct()
    {
        parent::__construct($this->name);
    }

    /**
     * Returns an array of fields for the CorePrinciples section.
     *
     * @return array An array of Field objects.
     */
    public static function fields(): array
    {
        return [
            new TextField('content[sec_title]', 'Section Title', validation: ['content.sec_title']),
            new TextField('content[sec_text]', 'Section Text', validation: ['content.sec_text']),
           
        ];
    }

    /**
     * Returns an array of fields for the CorePrinciples section repeater.
     *
     * @return array An array of Field objects.
     */
    public static function repeatedFields(): array
    {
        return [
            new TextField('content[0][principles_title]', 'Principles Title', validation: ['content.*.principles_title' => 'required']),
            new TextField('content[0][principles_text]', 'Principles Text', validation: ['content.*.principles_text' => 'required']),
            new FileField('content[0][principles_image]', 'Image', validation: ['content.*.principles_image' => imageValidation()]),
        ];
    }

    /**
     * Renders the CorePrinciples section.
     *
     * @return string The rendered section.
     */
    public function render(): string
    {
        return view(theme() . 'sections.core_principles', ['section' => $this, 'content' => $this->content, 'elements' => $this->element ?? []])->render();
    }
}
