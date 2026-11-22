<?php

namespace App\Sections;

use App\Sections\Fields\TextField;

/**
 * Class HistorySection
 *
 * Represents the history section of the website.
 *
 * @package App\Sections
 */
class HistorySection extends BaseSection
{
    protected string $name = 'history';
    protected string $title = 'History Section';
    protected string $keyword = 'history';
    protected bool $has_repeater = true;

    /**
     * HistorySection constructor.
     *
     * Initializes a new instance of the HistorySection class.
     */
    function __construct()
    {
        parent::__construct($this->name);
    }

    /**
     * Returns an array of fields for the history section.
     *
     * @return array An array of Field objects.
     */
    public static function fields(): array
    {
        return [
            // Top-left stats card
            new TextField('content[funfact_one_number]', 'Top Left Stat Number', '50', validation: ['content.funfact_one_number' => 'required']),
            new TextField('content[funfact_one_suffix]', 'Top Left Stat Suffix', 'k+', validation: ['content.funfact_one_suffix' => '']),
            new TextField('content[funfact_one_text]', 'Top Left Stat Label', 'Teams Empowered', validation: ['content.funfact_one_text' => 'required']),

            // Top-right stats card
            new TextField('content[funfact_two_number]', 'Top Right Stat Number', '10', validation: ['content.funfact_two_number' => 'required']),
            new TextField('content[funfact_two_suffix]', 'Top Right Stat Suffix', 'M+', validation: ['content.funfact_two_suffix' => '']),
            new TextField('content[funfact_two_text]', 'Top Right Stat Label', 'Documents Managed', validation: ['content.funfact_two_text' => 'required']),

            // Bottom-left stats card
            new TextField('content[funfact_three_number]', 'Bottom Left Stat Number', '99', validation: ['content.funfact_three_number' => 'required']),
            new TextField('content[funfact_three_suffix]', 'Bottom Left Stat Suffix', '.9%', validation: ['content.funfact_three_suffix' => '']),
            new TextField('content[funfact_three_text]', 'Bottom Left Stat Label', 'Platform Uptime', validation: ['content.funfact_three_text' => 'required']),

            // Bottom-right stats card
            new TextField('content[funfact_four_number]', 'Bottom Right Stat Number', '5', validation: ['content.funfact_four_number' => 'required']),
            new TextField('content[funfact_four_suffix]', 'Bottom Right Stat Suffix', '+', validation: ['content.funfact_four_suffix' => '']),
            new TextField('content[funfact_four_text]', 'Bottom Right Stat Label', 'Customer Retention', validation: ['content.funfact_four_text' => 'required']),
        ];
    }

    /**
     * Returns an array of fields for the history section repeater.
     *
     * @return array An array of Field objects.
     */
    public static function repeatedFields(): array
    {
        return [
            new TextField('content[0][history_title]', 'Story Block Title', validation: ['content.*.history_title' => 'required']),
            new TextField('content[0][history_text]', 'Story Block Description', validation: ['content.*.history_text' => 'required']),
        ];
    }

    private function funfacts(): array
    {
        return [
            [
                'number' => $this->content['funfact_one_number'] ?? '50',
                'suffix' => $this->content['funfact_one_suffix'] ?? 'k+',
                'text' => $this->content['funfact_one_text'] ?? 'Teams Empowered',
            ],
            [
                'number' => $this->content['funfact_two_number'] ?? '10',
                'suffix' => $this->content['funfact_two_suffix'] ?? 'm+',
                'text' => $this->content['funfact_two_text'] ?? 'Documents Managed',
            ],
            [
                'number' => $this->content['funfact_three_number'] ?? '99',
                'suffix' => $this->content['funfact_three_suffix'] ?? '.9%',
                'text' => $this->content['funfact_three_text'] ?? 'Platform Uptime',
            ],
            [
                'number' => $this->content['funfact_four_number'] ?? '5',
                'suffix' => $this->content['funfact_four_suffix'] ?? '+',
                'text' => $this->content['funfact_four_text'] ?? 'Customer Retention',
            ],
        ];
    }

    /**
     * Renders the history section.
     *
     * @return string The rendered section.
     */
    public function render(): string
    {
        return view(theme() . 'sections.history', [
            'section' => $this,
            'content' => $this->content,
            'elements' => $this->element ?? [],
            'funfacts' => $this->funfacts(),
        ])->render();
    }
}
