<?php
namespace App\Sections\Fields;

class TextField extends BaseField
{
    public function __construct(string $name, string $label, ?string $default = null, ?array $validation = [])
    {
        $this->name = $name;
        $this->label = $label;
        $this->default = $default;
        $this->validation = $validation;
    }

    function validation(){
        return $this->validation;
    }

    public function render($value = null): string
    {
        $value = $value ?? $this->default;
        
        return (string) view('components.input.text', [
            'name' => $this->name,
            'label' => $this->label,
            'value' => $value,
            'placeholder' => $this->label,
            'col' => 'col-lg-12',
        ]);
    }
}
