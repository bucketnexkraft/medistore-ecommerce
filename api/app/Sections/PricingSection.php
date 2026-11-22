<?php

namespace App\Sections;

use App\Models\SaasPlan;
use App\Sections\Fields\PageLinks;
use App\Sections\Fields\TextField;

/**
 * Pricing section class.
 */
class PricingSection extends BaseSection
{
    /**
     * The name of the pricing section.
     *
     * @var string
     */
    protected string $name = 'pricing';

    /**
     * The title of the pricing section.
     *
     * @var string
     */
    protected string $title = 'Pricing Section';

    /**
     * The keyword of the pricing section.
     *
     * @var string
     */
    protected string $keyword = 'pricing';

    /**
     * Flag indicating whether the pricing section has a repeater.
     *
     * @var bool
     */
    protected bool $has_repeater = false;

    /**
     * PricingSection constructor.
     */
    public function __construct()
    {
        parent::__construct($this->name);
    }

    /**
     * Returns an array of fields for the pricing section.
     *
     * @return array An array of Field objects.
     */
    public static function fields(): array
    {
        return [
            new TextField(
                'content[sec_title]',
                'Section Title',
                validation: ['content.sec_title' => 'required']
            ),
            new TextField(
                'content[sec_text]',
                'Section Text',
                validation: ['content.sec_text' => 'required']
            ),
            new TextField(
                'content[button_text]',
                'Button Text',
                validation: ['content.button_text' => 'required']
            ),
            new PageLinks(
                'content[button_link]',
                'Button Link',
                validation: ['content.button_link' => 'required']
            )
        ];
    }

    /**
     * Renders the pricing section view.
     *
     * @return string The rendered view.
     */
    public function render(): string
    {
        return view(
            theme() . 'sections.pricing',
            [
                'section' => $this,
                'content' => $this->content,
                'plans' => SaasPlan::query()
                    ->where('status', true)
                    ->orderByRaw("CASE WHEN is_free = 'free' THEN 0 ELSE 1 END")
                    ->orderBy('price')
                    ->paginate(settings('basic')->pagination),
            ]
        )->render();
    }
}
