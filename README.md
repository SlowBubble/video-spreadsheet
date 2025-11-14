# Goal

- Build a spreadsheet editor which is a video director that instructs the browser how to play out the desired video.




# m7e
- Remove the id field from Project.
- Show the last edit date in the home page when listing out the projects

# m7d (done)
- Create a class called TopLevelProject that contains:
  - Project
  - Metadata
    - id: same as the Project's id field
    - owner: use the auth.currentUser.uid if available when the project is first initialized; if auth is not available, just ''.
    - createdAt: Date.now() when the project is first created
    - lastEditedAt: Date.now() updated whenever you make a save to the project.
- Make import/export only paste/copy the Project part and not the Metadata
- Change the saving and loading from dao to use TopLevelProject instead of project
  - To make it compatible with existing project, when you first load from the dao and it is a Project instead of TopLevelProject, handle it by wrapping it in a TopLevelProject and setting the Metadata field appropriately
- Reason: This allows for more flexibility, like if we need to add project-unrelated fields, e.g. editor specific settings

# m7c (DONE)

- Use a new firestore project
  - Set up the same rules as before


# m7b (DONE)
- Add a sign in button in the homepage using firebase/auth and google as the auth provider.
- The homepage now includes Google sign-in functionality
- User email is displayed when signed in with a "Sign Out" button

# m7a (DONE)
- Refactor all the localStorage related logic into localStorageDao.ts, which should follow the same interface as firestoreDao.ts, because I'm planning to have a url param to toggle between using localStorage and firestore
- Storage Toggle: Use `&storage=firestore` URL parameter to switch between localStorage (default) and Firestore
- Both storage backends implement the same `IDao` interface
