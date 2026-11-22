<?php

namespace App\Sections;

use App\Models\Section;
use App\Sections\Fields\TextField;

class SocialSection extends BaseSection
{
    // The name of this section.
    protected string $name = 'social';
    // The title of this section.
    protected string $title = 'Social Section';
    // The keyword used for this section.
    protected string $keyword = 'social';
    // Indicates if this section has a repeater.
    protected bool $has_repeater = false;

    /**
     * Constructs a new HeroSection.
     */
    function __construct()
    {
        parent::__construct($this->name);
    }

    public static function fields(): array
    {
        return [
            new TextField('content[facebook]', 'Facebook Link', validation: ['content.facebook' => 'required']),
            new TextField('content[twitter]', 'Twitter Link', validation: ['content.twitter' => 'required']),
            new TextField('content[youtube]', 'YouTube Link', validation: ['content.youtube' => 'required']),
            new TextField('content[instagram]', 'Instagram Link', validation: ['content.instagram' => 'required']),
            new TextField('content[pinterest]', 'Pinterest Link', validation: ['content.pinterest' => 'required']),
        ];
    }

    public function render(): string
    {
        return view(theme() . 'sections.social', [
            'section' => $this,
            'content' => $this->content ?? [],
            'elements' => $this->element ?? []
        ])->render();
    }
    
}
