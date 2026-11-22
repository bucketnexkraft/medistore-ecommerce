<?php

namespace App\Sections;

use App\Sections\Fields\FileField;
use App\Sections\Fields\TextField;

/**
 * Represents the TeamSection of a page.
 */
class TeamSection extends BaseSection
{
    // The name of this section.
    protected string $name = 'team';
    // The title of this section.
    protected string $title = 'Team Section';
    // The keyword used for this section.
    protected string $keyword = 'team';
    // Indicates if this section has a repeater.
    protected bool $has_repeater = true;

    /**
     * Constructs a new TeamSection.
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
            new TextField('content[sec_title]', 'Section Title', validation: ['content.sec_title' => 'required']),
            // Subheading Field
            new TextField('content[sec_text]', 'Section Text', validation: ['content.sec_text' => 'required']),
        ];
    }

    /**
     * Returns an array of fields for the repeater of this section.
     *
     * @return array An array of Field objects.
     */
    public static function repeatedFields(): array
    {
        return [
            // Slider Element Field
            new TextField('content[0][name]', 'Name', validation: ['content.*.name' => 'required']),
            new TextField('content[0][name_link]', 'Name Link', validation: ['content.*.name_link' => 'nullable|string|max:255']),
            new TextField('content[0][designation]', 'Designation', validation: ['content.*.designation' => 'required']),
            new FileField('content[0][image]', 'Image', validation: ['content.*.image' => imageValidation()]),
            new TextField('content[0][social_text]', 'Social Text', 'Social Media', validation: ['content.*.social_text' => 'nullable|string|max:255']),
            new FileField('content[0][social_icon_1]', 'Social Icon 1', validation: ['content.*.social_icon_1' => imageValidation()]),
            new TextField('content[0][social_link_1]', 'Social Link 1', validation: ['content.*.social_link_1' => 'nullable|string|max:255']),
            new FileField('content[0][social_icon_2]', 'Social Icon 2', validation: ['content.*.social_icon_2' => imageValidation()]),
            new TextField('content[0][social_link_2]', 'Social Link 2', validation: ['content.*.social_link_2' => 'nullable|string|max:255']),
            new FileField('content[0][social_icon_3]', 'Social Icon 3', validation: ['content.*.social_icon_3' => imageValidation()]),
            new TextField('content[0][social_link_3]', 'Social Link 3', validation: ['content.*.social_link_3' => 'nullable|string|max:255']),
        ];
    }

    /**
     * Renders this section as a string.
     *
     * @return string The rendered section.
     */
    public function render(): string
    {
        return view(theme() . 'sections.team', [
            'section' => $this,
            'content' => $this->content,
            'elements' => $this->element ?? [],
        ])->render();
    }

    /**
     * Indicates if this section is fixed.
     *
     * @return bool True if this section is fixed, false otherwise.
     */
    public static function isFixed(): bool
    {
        return false;
    }
}
