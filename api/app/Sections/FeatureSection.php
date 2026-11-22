<?php

namespace App\Sections;

use App\Sections\Fields\FileField;
use App\Sections\Fields\TextField;

/**
 * Class FeatureSection
 *
 * Represents the about section of the website.
 *
 * @package App\Sections
 */
class FeatureSection extends BaseSection
{
    protected string $name = 'feature';
    protected string $title = 'Feature Section';
    protected string $keyword = 'feature';
    protected bool $has_repeater = true;

    /**
     * FeatureSection constructor.
     *
     * Initializes a new instance of the FeatureSection class.
     */
    function __construct()
    {
        parent::__construct($this->name);
    }

    /**
     * Returns an array of fields for the feature section.
     *
     * @return array An array of Field objects.
     */
    public static function fields(): array
    {
        return [
            new TextField('content[sec_title]', 'Section Title', validation: ['content.sec_title']),
            new TextField('content[sec_subtitle]', 'Section Subtitle', validation: ['content.sec_subtitle']),
           
        ];
    }

    /**
     * Returns an array of fields for the feature section repeater.
     *
     * @return array An array of Field objects.
     */
    public static function repeatedFields(): array
    {
        return [
            new TextField('content[0][feature_title]', 'Feature Title', validation: ['content.*.feature_title' => 'required']),
            new TextField('content[0][feature_text]', 'Feature Text', validation: ['content.*.feature_text' => 'required']),
            new FileField('content[0][feature_image]', 'Feature Image', validation: ['content.*.feature_image' => imageValidation()])
        ];
    }

    /**
     * Renders the feature section.
     *
     * @return string The rendered section.
     */
    public function render(): string
    {
        return view(theme() . 'sections.feature', ['section' => $this, 'content' => $this->content, 'elements' => $this->element ?? []])->render();
    }
}
