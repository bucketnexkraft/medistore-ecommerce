<?php 
namespace App\Sections\Fields;

use App\Models\Page;

class PageLinks extends BaseField
{
    public function __construct(string $name, string $label, ?string $default = null,?array $validation = [],bool $multiple = false)
    {
        $this->name = $name;
        $this->label = $label;
        $this->default = $default;
        $this->validation = $validation;
        $this->multiple = $multiple;
    }

    function validation(){
        return $this->validation;
    }

    public function render($value = null): string
    {
        $value = $value ?? $this->default;
        
        return (string) view('components.input.page_links', [
            'name' => $this->name,
            'label' => $this->label,
            'value' => $value,
            'placeholder' => $this->label,
            'pages' => Page::active()->get(['slug','name']),
            'multiple' => $this->multiple   
        ]);
    }
}