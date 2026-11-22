<?php
namespace App\Sections\Fields;

class FileField extends BaseField{

    public function __construct(string $name, string $label, ?string $default = null, ?string $col = 'col-lg-3', ?array $validation = [], $multiple = false)
    {
        $this->name = $name;
        $this->label = $label;
        $this->default = $default;
        $this->col = $col;
        $this->validation = $validation;
        $this->multiple = $multiple;
    }

    function validation(){
        return $this->validation;
    }

    public function render($value = null): string
    {
        return view('components.image-uploader', [
            'name' => $this->name,
            'title' => $this->label,
            'image' => $value,
            'folder' => 'sections',
            'is_from_builder' => true,
            'col' => $this->col,
            'multiple' => $this->multiple
        ])->render();
    }

}