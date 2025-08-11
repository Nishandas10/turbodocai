#folder structure
/app
  /notes
    /[noteId]
      page.tsx          // The dynamic notebook page
  /api
    /notes
      route.ts          // API endpoint to create new notes
/components
  NotebookEditor.tsx    // The notebook editor UI

#Create the Dynamic Notebook
A. Dynamic Route
In app/notes/[noteId]/page.tsx (App Router):
B. Creating New Notes
Your /api/notes/route.ts

#When user clicks “New Notebook”, you:

Call /api/notes (POST) to create a note.
Get back id.
Redirect user to /notes/{id}