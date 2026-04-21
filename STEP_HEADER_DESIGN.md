# Step Header Design

This document defines the visual design and behavior of the step header for the event creation workflow. The goal is to create a clear, reassuring, and intuitive navigation element.

## 1. Positioning and Layout

-   **Positioning:** The step header will be a horizontal bar that is sticky to the top of the page. This ensures it is always visible, giving the organizer a constant sense of place.
-   **Layout:** The steps will be laid out horizontally, with equal spacing. On smaller screens, the step names may be hidden to save space, showing only the step numbers.
-   **Save Status:** The top-right corner of the header will display the save status ("Saving...", "Last saved at..."), providing constant reassurance that the user's work is safe.

## 2. Visual States of a Step

Each step in the header will have three distinct visual states to clearly communicate the user's progress:

### a. Upcoming Step

-   **Appearance:** A muted, neutral look. The step number is displayed inside a light gray circle. The step name is in a light gray text.
-   **Behavior:** Not clickable. This prevents the user from jumping ahead and getting lost.
-   **Purpose:** Clearly indicates what's next without being distracting.

### b. Current Step

-   **Appearance:** A bright, active look. The step number is displayed inside a vibrant blue circle. The step name is in a bold, blue text.
-   **Behavior:** Clickable (though it does nothing as it's the current step). This maintains visual consistency with completed steps.
-   **Purpose:** Draws the user's attention to their current task.

### c. Completed Step

-   **Appearance:** A positive, reassuring look. The step number is replaced with a checkmark icon inside a green circle. The step name is in a standard, dark gray text.
-   **Behavior:** Clickable. The user can click on any completed step to go back and edit it.
-   **Purpose:** Provides a sense of accomplishment and allows for easy, non-linear navigation to previous steps.

## 3. Interaction

-   **Hover:** When the user hovers over a clickable step (completed or current), it should have a subtle hover effect (e.g., a slight change in background color) to indicate that it is interactive.
-   **Click:** Clicking a completed step will immediately navigate the user to that step in the workflow.

This design provides a clear, at-a-glance understanding of the entire workflow, the user's progress, and the next steps, reducing uncertainty and making the process feel manageable and reassuring.
