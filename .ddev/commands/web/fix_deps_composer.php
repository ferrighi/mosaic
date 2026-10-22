<?php

if ($argc < 2) {
    echo "Usage: php script.php <path_to_composer.json>\n";
    exit(1);
}

$filePath = $argv[1];

// Check if the file exists
if (!file_exists($filePath)) {
    echo "Error: File not found at '$filePath'.\n";
    exit(1);
}

// Read the content of the file
$jsonContent = file_get_contents($filePath);

if ($jsonContent === false) {
    echo "Error: Unable to read the file '$filePath'.\n";
    exit(1);
}

// Decode the JSON content
$data = json_decode($jsonContent, true);

if ($data === null) {
    echo "Error: Invalid JSON in '$filePath'.\n";
    exit(1);
}

// Ensure the 'extra' and 'extra.installer-paths' keys exist
if (!isset($data['extra'])) {
    $data['extra'] = [];
}

if (!isset($data['extra']['installer-paths'])) {
    $data['extra']['installer-paths'] = [];
}

// Add a new key to 'extra.installer-paths'
$newKey = 'web/modules/custom/{$name}';
$newValue = ["type:drupal-custom-module"];

$data['extra']['installer-paths'][$newKey] = $newValue;

// Encode back to JSON (with pretty printing)
$newJsonContent = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);

if ($newJsonContent === false) {
    echo "Error: Failed to encode JSON.\n";
    exit(1);
}

// Save the updated content back to the file
if (file_put_contents($filePath, $newJsonContent) === false) {
    echo "Error: Unable to write to the file '$filePath'.\n";
    exit(1);
}

echo "composer.json updated successfully.\n";
