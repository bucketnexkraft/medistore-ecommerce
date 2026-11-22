<?php

namespace App\Sections;

use App\Sections\Fields\PageLinks;
use App\Sections\Fields\TextField;

/**
 * ContactSection class
 *
 * This class represents the contact section
 * of the application.
 *
 * @package App\Sections
 */
class ContactSection extends BaseSection
{
    /** @var string $name The name of the section */
    protected string $name = 'contact';

    /** @var string $title The title of the section */
    protected string $title = 'Contact Section';

    /** @var string $keyword The keyword of the section */
    protected string $keyword = 'contact';

    /** @var bool $has_repeater Whether the section has a repeater */
    protected bool $has_repeater = true;

    /**
     * Constructor for the ContactSection class.
     *
     * Initializes a new instance of the ContactSection class.
     */
    function __construct()
    {
        parent::__construct($this->name);
    }

    /**
     * Returns an array of fields for the contact section.
     *
     * @return array An array of Field objects.
     */
    public static function fields(): array
    {
        return [
            new TextField('content[card_heading]', 'Form Heading', validation: ['content.card_heading' => 'required|string|max:255']),
            new TextField('content[form_description]', 'Form Description', validation: ['content.form_description' => 'nullable|string|max:500']),
            new TextField('content[side_section_last_text]', 'Side Chip Text', validation: ['content.side_section_last_text' => 'nullable|string|max:255']),
            new TextField('content[side_section_title]', 'Side Section Title', validation: ['content.side_section_title' => 'required|string|max:255']),
            new TextField('content[side_section_text]', 'Side Section Text', validation: ['content.side_section_text' => 'required|string|max:500']),
            new TextField('content[side_section_button_title]', 'Side Button Title', validation: ['content.side_section_button_title' => 'required|string|max:255']),
            new PageLinks('content[side_section_button_url]', 'Side Button URL', validation: ['content.side_section_button_url' => 'required']),
        ];
    }

    /**
     * Returns an array of repeated fields for the contact section.
     *
     * @return array An array of Field objects.
     */
    public static function repeatedFields(): array
    {
        return [
            new TextField('content[0][label]', 'Info Label', validation: ['content.*.label' => 'required|string|max:255']),
            new TextField('content[0][value]', 'Info Value', validation: ['content.*.value' => 'required|string|max:255']),
            new TextField('content[0][type]', 'Info Type (email/phone/hours)', validation: ['content.*.type' => 'nullable|string|max:50']),
        ];
    }

    /**
     * Renders the contact section.
     *
     * @return string The rendered contact section.
     */
    public function render(): string
    {
        return view(theme() . 'sections.contact', [
            'section' => $this,
            'content' => $this->content,
            'elements' => $this->element
        ])->render();
    }
}
