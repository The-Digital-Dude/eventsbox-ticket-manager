# Redesigning the Layout Step: The Event Space UX

This document outlines a redesigned user experience for the layout setup step. The goal is to transform it from a technical configuration task into a visual and intuitive process of designing the event space.

## 1. Framing: "Design Your Event Space"

First, we will change the language to be more creative and less technical.

-   **Step Name:** The step will be called **"3. Your Event Space"**.
-   **Page Title:** The main title will be **"Design Your Event Space"**.
-   **Core Concepts:**
    -   "Layout" becomes **"Event Space"** or **"Floor Plan"**.
    -   "Sections" become **"Seating Areas"** or just **"Areas"**.
    -   "Configuration" becomes **"Setup"** or **"Arrangement"**.

## 2. A More Visual and Guided Entry

Instead of dropping the user directly into the full builder interface, we will provide a guided entry to the step.

-   **The Welcome Message:** As proposed in `LAYOUT_TRIGGER_UX.md`, the user is greeted with a helpful message that explains why they are here and offers to start from a venue template if one is available.
-   **A Simple First Choice:** If starting from a blank canvas, the first thing the user sees is a simple, visual choice:

    > **What kind of area do you want to create first?**
    >
    > -   **[Icon of seats] Rows of Seats**
    > -   **[Icon of tables] Tables**
    > -   **[Icon of a crowd] An Open General Admission Area**

    This immediately frames the task in terms of tangible, real-world objects, not abstract data structures.

## 3. Adapting the Existing Seating Builder

We will reuse the powerful `LayoutBuilderShell` component, but we will wrap it in our `LayoutSetupStep` component to create a more tailored and user-friendly experience.

-   **Contextual Help:** The `LayoutSetupStep` wrapper will display contextual tips and guidance. For example, when the user is creating a table area, a tip might appear: *"Remember, your ticket quantity for this area will be the number of tables, not the number of seats."*

-   **Simplified UI:** The `LayoutSetupStep` can choose to hide or simplify some of the more advanced options in the `LayoutBuilderShell` initially, revealing them only when the user needs them. For example, the detailed seat numbering and labeling options can be tucked away under an "Advanced Settings" toggle.

-   **Live Summary:** As the user adds, removes, or changes seating areas, a live summary will be displayed on the page (but outside the builder itself). This summary will show:
    -   **Total Seats:** [Number]
    -   **Total Tables:** [Number]
    -   **Total Capacity:** [Number]

    This provides immediate, tangible feedback on the space they are creating.

## 4. The Feeling of Direct Manipulation

The experience should feel like building with digital LEGOs, not filling out a database form.

-   **Visual Representation:** The `LayoutBuilderShell` already does a good job of this by providing a visual canvas. We will ensure the visual elements are clean, clear, and aesthetically pleasing.
-   **Immediate Feedback:** Changes made on the canvas should be reflected instantly in the live summary.

By wrapping the existing builder in a more user-friendly and context-aware adapter, and by carefully managing the language and presentation, we can transform the layout setup step from an intimidating technical task into an engaging and empowering part of the creative event setup process.
