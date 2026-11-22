<?php

namespace App\Sections;

use App\Sections\Fields\FileField;
use App\Sections\Fields\PageLinks;
use App\Sections\Fields\TextField;
use Dom\Text;

/**
 * Class FaqSection
 *
 * This class represents the Faq section in the application.
 *
 * @package App\Sections
 */
class FaqSection extends BaseSection
{
    /**
     * The name of the section.
     *
     * @var string
     */
    protected string $name = 'faq';

    /**
     * The title of the section.
     *
     * @var string
     */
    protected string $title = 'Faq Section';

    /**
     * The keyword of the section.
     *
     * @var string
     */
    protected string $keyword = 'faq';

    /**
     * Indicates if the section has a repeater.
     *
     * @var bool
     */
    protected bool $has_repeater = true;

    /**
     * FaqSection constructor.
     */
    public function __construct()
    {
        parent::__construct($this->name);
    }

    /**
     * Returns an array of fields for the Faq section.
     *
     * @return array An array of Field objects.
     */
    public static function fields(): array
    {
        return [
            new TextField('content[sec_title]', 'Section Title', validation: ['content.sec_title' => 'required']),
            new TextField('content[sec_text]', 'Section Text', validation: ['content.sec_text' => 'required']),
            new TextField('content[subheading]', 'Section Subheading', validation: ['content.subheading' => 'required']),

            new TextField('content[contact_title]', 'Contact Title', validation: ['content.contact_title' => 'required']),
            new TextField('content[contact_subtitle]', 'Contact Subtitle', validation: ['content.contact_subtitle' => 'required']),
            new TextField('content[contact_button_text]', 'Contact Button Text', validation: ['content.contact_button_text' => 'required']),
            new PageLinks('content[contact_button_link]', 'Contact Button Link', validation: ['content.contact_button_link' => 'required']),
            new FileField('content[faq_image]', 'Faq Image', validation: ['content.faq_image' => 'required|image']),

        ];
    }

    /**
     * Returns an array of fields for the Faq section repeater.
     *
     * @return array An array of Field objects.
     */
    public static function repeatedFields(): array
    {
        return [
            new TextField('content[0][question]', 'Question', validation: ['content.*.question' => 'required']),
            new TextField('content[0][answer]', 'Answer', validation: ['content.*.answer' => 'required']),
        ];
    }

    /**
     * Renders the Faq section view.
     *
     * @return string The rendered view.
     */
    public function render(): string
    {
        return view(theme() . 'sections.faq', $this->viewData())->render();
    }

    private function viewData(): array
    {
        return [
            'section' => $this,
            'content' => $this->content,
            'elements' => $this->element,
            'faqItems' => $this->getFaqItems(),
            'faqTitle' => $this->getFaqTitle(),
            'faqText' => $this->getFaqText(),
            'faqButtonText' => $this->getFaqButtonText(),
            'faqButtonUrl' => $this->getFaqButtonUrl(),
        ];
    }

    private function getFaqItems(): array
    {
        return collect($this->element ?? [])
            ->filter(fn ($item) => !empty($item['question']) || !empty($item['answer']))
            ->values()
            ->map(fn ($item) => [
                'question' => trim((string) ($item['question'] ?? '')),
                'answer' => trim((string) ($item['answer'] ?? '')),
            ])
            ->all();
    }

    private function getFaqTitle(): string
    {
        return $this->content['sec_title']
            ?? $this->content['heading']
            ?? 'Frequently Asked Questions';
    }

    private function getFaqText(): string
    {
        return $this->content['sec_text']
            ?? $this->content['subheading']
            ?? 'Answers For Questions You Might Have';
    }

    private function getFaqButtonText(): string
    {
        return $this->content['button_text']
            ?? 'Talk to us';
    }

    private function getFaqButtonUrl(): string
    {
        $link = $this->content['button_link'] ?? '#';

        if (empty($link) || $link === '#') {
            return '#';
        }

        return url($link);
    }
}
