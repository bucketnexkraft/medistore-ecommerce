<?php

namespace App\Sections;

use App\Sections\Fields\FileField;
use App\Sections\Fields\TextField;

/**
 * Class WorkingStepSection
 *
 * Represents the about section of the website.
 *
 * @package App\Sections
 */
class WorkingStepSection extends BaseSection
{
    protected string $name = 'working_step';
    protected string $title = 'Working Section';
    protected string $keyword = 'working_step';
    protected bool $has_repeater = true;

    /**
     * WorkingStepSection constructor.
     *
     * Initializes a new instance of the WorkingStepSection class.
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
            new TextField('content[sec_title]', 'Section Title', validation: ['content.sec_title' => 'required']),
            new TextField('content[sec_subtitle]', 'Section Subtitle', validation: ['content.sec_subtitle' => 'required']),
            new TextField('content[sec_text]', 'Section Text', validation: ['content.sec_text' => 'required']),
            new FileField('content[work-bg-1]', 'Bg Image', col: 'col-lg-3', validation: ['content.work-bg-1'=> imageValidation()]),         
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
            new TextField('content[0][working_title]', 'Working Title', validation: ['content.*.working_title' => 'required']),
            new TextField('content[0][working_text]', 'Working Text', validation: ['content.*.working_text' => 'required']),
            new FileField('content[0][working_icon]', 'Working Icon', validation: ['content.*.working_icon' => imageValidation()]),
        ];
    }

    /**
     * Renders the feature section.
     *
     * @return string The rendered section.
     */
    public function render(): string
    {
        return view(theme() . 'sections.working_step', ['section' => $this, 'content' => $this->content, 'elements' => $this->element ?? []])->render();
    }
}
