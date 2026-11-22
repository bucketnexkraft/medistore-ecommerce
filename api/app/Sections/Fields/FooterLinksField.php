<?php

namespace App\Sections\Fields;

use App\Models\Page;

class FooterLinksField extends BaseField
{
    protected string $name;
    protected string $label;
    protected ?array $validation;

    public function __construct(string $name, string $label, ?array $validation = [])
    {
        $this->name = $name;
        $this->label = $label;
        $this->validation = $validation;
    }

     function validation(){
        return $this->validation;
    }

    public function render($value = []): string
    {
        $pages = Page::pluck('name', 'slug')->toArray();

        if (empty($value)) {
            $value = [
                [
                    'title' => 'Quick Links',
                    'links' => [['name' => 'Home', 'slug' => 'home']],
                ],
            ];
        }

        // Pass data into a Blade file
        return view('components.input.footer_links', [
            'name' => $this->name,
            'pages' => $pages,
            'value' => $value,
        ])->render();
    }
}
