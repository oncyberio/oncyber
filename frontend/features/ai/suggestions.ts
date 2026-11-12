import { AI_ACTIONS } from "./context/types";

function onFocus({ prompt, dispatch, value }) {
    dispatch({
        type: AI_ACTIONS.CHANGE_PROMPT_VALUE,
        payload: { value },
    });
}

function onSelect({ prompt, dispatch, submitIntent }) {
    submitIntent();
}

export const defaultSuggestions = {
    title: "QUICK ACTIONS",
    suggestions: [
        {
            id: "1",
            text: "Add all artworks",
            onfocus: ({ prompt, dispatch }) =>
                onFocus({
                    prompt,
                    dispatch,
                    value: "Add all artworks",
                }),
            onselect: ({ prompt, dispatch, submitIntent }) =>
                onSelect({ prompt, dispatch, submitIntent }),
        },
        {
            id: "2",
            text: "Remove all artworks",
            onfocus: ({ prompt, dispatch }) =>
                onFocus({
                    prompt,
                    dispatch,
                    value: "Remove all artworks",
                }),
            onselect: ({ prompt, dispatch, submitIntent }) =>
                onSelect({ prompt, dispatch, submitIntent }),
        },
        {
            id: "3",
            text: "Add all my video assets to this wall",
            onfocus: ({ prompt, dispatch }) =>
                onFocus({
                    prompt,
                    dispatch,
                    value: "Add all my video assets to this wall",
                }),
            onselect: ({ prompt, dispatch, submitIntent }) =>
                onSelect({ prompt, dispatch, submitIntent }),
        },
        {
            id: "4",
            text: "Make all assets 20% bigger",
            onfocus: ({ prompt, dispatch }) =>
                onFocus({
                    prompt,
                    dispatch,
                    value: "Make all assets 20% bigger",
                }),
            onselect: ({ prompt, dispatch, submitIntent }) =>
                onSelect({ prompt, dispatch, submitIntent }),
        },
        {
            id: "5",
            text: "Change sky to an orbit view",
            onfocus: ({ prompt, dispatch }) =>
                onFocus({
                    prompt,
                    dispatch,
                    value: "Change sky to an orbit view",
                }),
            onselect: ({ prompt, dispatch, submitIntent }) =>
                onSelect({ prompt, dispatch, submitIntent }),
        },
    ],
};

export const selectedAssetSuggestions = {
    title: "QUICK ACTIONS",
    suggestions: [
        {
            id: "1",
            text: "Remove the selected artwork",
            onfocus: ({ prompt, dispatch }) =>
                onFocus({
                    prompt,
                    dispatch,
                    value: "Remove the selected artwork",
                }),
            onselect: ({ prompt, dispatch, submitIntent }) =>
                onSelect({ prompt, dispatch, submitIntent }),
        },
        {
            id: "2",
            text: "Make it 20% bigger",
            onfocus: ({ prompt, dispatch }) =>
                onFocus({
                    prompt,
                    dispatch,
                    value: "Make it 20% bigger",
                }),
            onselect: ({ prompt, dispatch, submitIntent }) =>
                onSelect({ prompt, dispatch, submitIntent }),
        },
        {
            id: "3",
            text: "Replace with a random NFT",
            onfocus: ({ prompt, dispatch }) =>
                onFocus({
                    prompt,
                    dispatch,
                    value: "Replace with a random NFT",
                }),
            onselect: ({ prompt, dispatch, submitIntent }) =>
                onSelect({ prompt, dispatch, submitIntent }),
        },
        {
            id: "4",
            text: "Add a white frame",
            onfocus: ({ prompt, dispatch }) =>
                onFocus({
                    prompt,
                    dispatch,
                    value: "Add a white frame",
                }),
            onselect: ({ prompt, dispatch, submitIntent }) =>
                onSelect({ prompt, dispatch, submitIntent }),
        },
        {
            id: "5",
            text: "Add a text above 'My Biggest W'",
            onfocus: ({ prompt, dispatch }) =>
                onFocus({
                    prompt,
                    dispatch,
                    value: "Add a text above 'My Biggest W'",
                }),
            onselect: ({ prompt, dispatch, submitIntent }) =>
                onSelect({ prompt, dispatch, submitIntent }),
        },
    ],
};

export const placeholderSuggestions = {
    title: "QUICK ACTIONS",
    suggestions: [
        {
            id: "1",
            text: "Hang a random artwork",
            onfocus: ({ prompt, dispatch }) =>
                onFocus({
                    prompt,
                    dispatch,
                    value: "Hang a random artwork",
                }),
            onselect: ({ prompt, dispatch, submitIntent }) =>
                onSelect({ prompt, dispatch, submitIntent }),
        },
        {
            id: "2",
            text: "Add a portal to Hub",
            onfocus: ({ prompt, dispatch }) =>
                onFocus({
                    prompt,
                    dispatch,
                    value: "Add a portal to Hub",
                }),
            onselect: ({ prompt, dispatch, submitIntent }) =>
                onSelect({ prompt, dispatch, submitIntent }),
        },
        {
            id: "3",
            text: "Add one oncyber asset here",
            onfocus: ({ prompt, dispatch }) =>
                onFocus({
                    prompt,
                    dispatch,
                    value: "Add one oncyber asset here",
                }),
            onselect: ({ prompt, dispatch, submitIntent }) =>
                onSelect({ prompt, dispatch, submitIntent }),
        },
        {
            id: "4",
            text: "Add some jazz music from youtube",
            onfocus: ({ prompt, dispatch }) =>
                onFocus({
                    prompt,
                    dispatch,
                    value: "Add some jazz music from youtube",
                }),
            onselect: ({ prompt, dispatch, submitIntent }) =>
                onSelect({ prompt, dispatch, submitIntent }),
        },
        {
            id: "5",
            text: "Add https://coolwebsite.com",
            onfocus: ({ prompt, dispatch }) =>
                onFocus({
                    prompt,
                    dispatch,
                    value: "Add https://coolwebsite.com",
                }),
            onselect: ({ prompt, dispatch, submitIntent }) =>
                onSelect({ prompt, dispatch, submitIntent }),
        },
    ],
};