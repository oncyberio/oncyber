import { Experience } from "@uitypes/experience";
import {
    changePrivilege,
    getEditorsProfile,
    getExhibitEditors,
} from "@utils/saveToDb";
import AccountsAPI from "@api/accounts/_api";

export async function fetchEditors(exhibit: Experience) {
    //
    if (exhibit?.mock) return;

    const editors = exhibit.id
        ? await AccountsAPI.getUsers({
              exhibitId: exhibit.id,
              type: "editors",
          })
        : null;

    if (editors.success) {
        return editors?.editors
            ?.sort?.((a: any, b: any) => {
                let val1 = 0;

                let val2 = 0;

                if (a.privilege === "owner") {
                    val1 = Infinity;
                }

                if (b.privilege === "owner") {
                    val2 = Infinity;
                }

                return val2 - val1;
            })
            .map((editor) => {
                return editor;
            });
    } else {
        //
        throw new Error("Failed to fetch collabs");
    }
}
