<?php

namespace App\Sections;

use App\Models\Blog;
use App\Sections\BaseSection;
use App\Sections\Fields\PageLinks;
use App\Sections\Fields\TextField;

/**
 * Class BlogSection
 *
 * This class represents a section for the blog.
 *
 * @package App\Sections
 */
class BlogSection extends BaseSection
{
    /**
     * Section name.
     *
     * @var string
     */
    protected string $name = 'blog';

    /**
     * Title of the section.
     *
     * @var string
     */
    protected string $title = 'Blog Section';

    /**
     * Keyword for the section.
     *
     * @var string
     */
    protected string $keyword = 'blog';

    /**
     * Whether the section has a repeater.
     *
     * @var bool
     */
    protected bool $has_repeater = false;

    /**
     * BlogSection constructor.
     *
     * Initializes the section with the given name.
     *
     * @return void
     */
    function __construct()
    {
        parent::__construct($this->name);
    }

    /**
     * Returns an array of fields for the blog section.
     *
     * @return array
     */
    public static function fields(): array
    {
        return [
            new TextField('content[heading]', 'Heading', validation: ['content.heading' => 'required']),
            new TextField('content[subheading]', 'Subheading', validation: ['content.subheading' => 'required']),
            new TextField('content[button_text]', 'Button Text', validation: ['content.button_text' => 'required']),
            new PageLinks('content[button_link]', 'Button Link', validation: ['content.button_link' => 'required']),
        ];
    }

    /**
     * Renders the blog section view.
     *
     * @return string
     */
    public function render(): string
    {
        return view(theme() . 'sections.blog', [
            'section' => $this,
            'content' => $this->content,
            'blogs' => Blog::active(),
        ])->render();
    }
}
