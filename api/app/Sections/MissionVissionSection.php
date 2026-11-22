<?php

namespace App\Sections;

use App\Sections\Fields\FileField;
use App\Sections\Fields\TextField;

/**
 * Class MissionVissionSection
 *
 * Represents the MissionVissionSection section of the website.
 *
 * @package App\Sections
 */
class MissionVissionSection extends BaseSection
{
    protected string $name = 'mission_vission';
    protected string $title = 'Mission Vission Section';
    protected string $keyword = 'mission_vission';
    protected bool $has_repeater = false;

    /**
     * MissionVissionSection constructor.
     *
     * Initializes a new instance of the MissionVissionSection class.
     */
    function __construct()
    {
        parent::__construct($this->name);
    }

    /**
     * Returns an array of fields for the mission_vission section.
     *
     * @return array An array of Field objects.
     */
    public static function fields(): array
    {
        return [
            new TextField('content[mission_title]', 'Mission Title', validation: ['content.mission_title' => 'required']),
            new TextField('content[mission_text]', 'Mission Text', validation: ['content.mission_text' => 'required']),
            new TextField('content[vission_title]', 'Vission Title', validation: ['content.vission_title' => 'required']),
            new TextField('content[vission_text]', 'Vission Text', validation: ['content.vission_text' => 'required']),
            new FileField('content[missionImage]', 'Mission Image', validation: ['content.missionImage' => imageValidation()]),
        ];
    }

    /**
     * Renders the mission_vission section.
     *
     * @return string The rendered section.
     */
    public function render(): string
    {
        return view(theme() . 'sections.mission_vission', [ 'section' => $this, 'content' => $this->content, 'elements' => $this->element ?? [], ])->render();
    }
}
