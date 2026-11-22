<?php

namespace App\Sections;

/**
 * A registry class for all sections in the application.
 */
class SectionRegistry
{
    /**
     * An array of all sections in the application.
     *
     * @var array<string>
     */
    protected static array $sections = [
        HeroSection::class,
        FeatureSection::class,
        EcommerceSetupSection::class,
        WorkingStepSection::class,
        TestimonialSection::class,
        FaqSection::class,
        FooterSection::class,
        HistorySection::class,
        MissionVissionSection::class,
        CorePrinciplesSection::class,
        TeamSection::class,
        PricingSection::class,
        BlogSection::class,
        ContactSection::class
    ];

    /**
     * Returns an array of all sections in the application.
     *
     * @return array<string>
     */
    public static function all(): array
    {
        return self::$sections;
    }

    /**
     * Returns an array of all sections in the application in the format of
     * dropdown options.
     *
     * @return array<string, string>
     */
    public static function dropdownOptions(): array
    {
        $options = [];
        foreach (self::$sections as $class) {
            $instance = new $class();
            $options[$instance->getName()] = $instance->getTitle();
        }
        return $options;
    }

    /**
     * Finds a section by its name.
     *
     * @param string $name The name of the section.
     * @return ?string The class of the section if found, null otherwise.
     */
    public static function findByName(string $name): ?string
    {
        foreach (self::$sections as $class) {
            if ((new $class())->getName() === $name) {
                return $class;
            }
        }
        return null;
    }

    /**
     * Creates an instance of a section by its name.
     *
     * @param string $name The name of the section.
     * @param array $content The content of the section.
     * @return ?BaseSection The instance of the section if found, null otherwise.
     */
    public static function make(string $name, array $content = []): ?BaseSection
    {
        foreach (self::$sections as $class) {
            $instance = new $class($content);
            if ($instance->getName() === $name) {
                return $instance;
            }
        }
        return null;
    }
}
