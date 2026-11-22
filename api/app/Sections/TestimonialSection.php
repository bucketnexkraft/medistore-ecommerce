<?php

namespace App\Sections;

use App\Sections\Fields\FileField;
use App\Sections\Fields\TextareaField;
use App\Sections\Fields\TextField;

/**
 * Class TestimonialSection
 *
 * Represents the about section of the website.
 *
 * @package App\Sections
 */
class TestimonialSection extends BaseSection
{
    protected string $name = 'testimonial';
    protected string $title = 'Testimonial Section';
    protected string $keyword = 'testimonial';
    protected bool $has_repeater = true;

    /**
     * TestimonialSection constructor.
     *
     * Initializes a new instance of the TestimonialSection class.
     */
    function __construct()
    {
        parent::__construct($this->name);
    }

    /**
     * Returns an array of fields for the testimonial section.
     *
     * @return array An array of Field objects.
     */
    public static function fields(): array
    {
        return [
            new TextField('content[sec_title]', 'Section Title', validation: ['content.sec_title' => 'required']),
            new TextField('content[sec_subtitle]', 'Section Subtitle', validation: ['content.sec_subtitle' => 'required']),
            new TextField('content[counter_text]', 'Counter Text', validation: ['content.counter_text' => 'required']),
            new TextField('content[counter_number]', 'Counter Number', validation: ['content.counter_number' => 'required|integer']),
            new FileField('content[testimonial_image]', 'Testimonial Image', validation: ['content.testimonial_image' => 'required|image']),
        ];
    }

    /**
     * Returns an array of fields for the testimonial section repeater.
     *
     * @return array An array of Field objects.
     */
    public static function repeatedFields(): array
    {
        return [
            new TextField('content[0][client_name]', 'Client Name', validation: ['content.*.client_name' => 'required']),
            new TextField('content[0][designation]', 'Client Designation', validation: ['content.*.designation' => 'required']),
            new TextField('content[0][client_rating]', 'Client Rating', validation: ['content.*.client_rating' => 'required|integer|min:1|max:5']),
            new TextField('content[0][title]', 'Client Title', validation: ['content.*.title' => 'required']),
            new TextareaField('content[0][client_text]', 'Client Text', validation: ['content.*.client_text' => 'required'])
        ];
    }

    /**
     * Renders the testimonial section.
     *
     * @return string The rendered section.
     */
    public function render(): string
    {
        return view(theme() . 'sections.testimonial', ['section' => $this, 'content' => $this->content, 'elements' => $this->element ?? []])->render();
    }
}
