import {getAdminRoleName, getMemberRoleName, isAdmin, isMember, requireValidBoardMember} from "./permission";
import {api, newObject} from "./util";

interface AddNoteRequest {
  boardId: string;
  columnId: string;
  text: string;
}

interface EditNoteRequest {
  columnId: string;
  text: string;
}

interface DeleteNoteRequest {
  noteId: string;
}

export const initializeNoteFunctions = () => {
  api<AddNoteRequest, boolean>("addNote", async (user, request) => {
    await requireValidBoardMember(user, request.boardId);
    const note = newObject(
      "Note",
      {
        text: request.text,
        author: user,
        board: Parse.Object.extend("Board").createWithoutData(request.boardId),
        columnId: request.columnId,
      },
      {
        readRoles: [getMemberRoleName(request.boardId), getAdminRoleName(request.boardId)],
        writeRoles: [getAdminRoleName(request.boardId)],
      }
    );
    await note.save(null, {useMasterKey: true});
    return true;
  });

  api<{note: Partial<EditNoteRequest> & {id: string}}, boolean>("editNote", async (user, request) => {
    const query = new Parse.Query(Parse.Object.extend("Note"));
    const note = await query.get(request.note.id, {useMasterKey: true});

    if ((await isAdmin(user, note.get("board").id)) || user.id === note.get("author").id) {
      if (request.note.text) {
        note.set("text", request.note.text);
      }

      if (request.note.columnId) {
        note.set("columnId", request.note.columnId);
      }

      await note.save(null, {useMasterKey: true});
      return true;
    }

    throw new Error(`Not authorized to edit note '${request.note.id}'`);
  });

  api<DeleteNoteRequest, boolean>("deleteNote", async (user, request) => {
    const query = new Parse.Query(Parse.Object.extend("Note"));
    const note = await query.get(request.noteId, {useMasterKey: true});

    if ((await isAdmin(user, note.get("board").id)) || user.id === note.get("author").id) {
      const voteQuery = await new Parse.Query("Vote");
      voteQuery.equalTo("note", note);
      await Parse.Object.destroyAll([note, ...(await voteQuery.find({useMasterKey: true}))], {useMasterKey: true});
      return true;
    }

    throw new Error(`Not authorized to delete note '${request.noteId}'`);
  });
};
