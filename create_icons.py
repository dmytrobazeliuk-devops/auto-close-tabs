#!/usr/bin/env python3
"""
Simple fallback icon generator without external dependencies.
Creates placeholder PNG icons for the Chrome extension.
"""

import base64
import os


def create_simple_png(size):
    """Return a minimal PNG payload for a placeholder icon."""
    # Minimal 1x1 PNG pixel
    png_data = base64.b64decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    )
    return png_data


def main():
    """Create basic icons for every supported size."""
    os.makedirs('icons', exist_ok=True)

    sizes = [16, 32, 48, 128]

    for size in sizes:
        print(f"Creating basic icon {size}x{size}...")
        png_data = create_simple_png(size)

        with open(f'icons/icon{size}.png', 'wb') as f:
            f.write(png_data)

        print(f"Saved: icons/icon{size}.png")

    print("\nBasic icons created!")
    print("Open convert_icons.html to design higher quality icons")


if __name__ == "__main__":
    main()
