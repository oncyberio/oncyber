/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import DestinationDetails from "./DestinationDetails";
import UploadDestination from "./UploadDestination";
const act = (React as any).act;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;
const mockUpdate = jest.fn();
const mockSubmit = jest.fn();
const mockMint = jest.fn();
const mockEdit = jest.fn();
const mockClose = jest.fn();
const mockAction = jest.fn();
let mockDestination: any;
jest.mock("@features/landing-carousel/components/ExperienceCard", () => ({
    CoverImage: ({ card }) => <img src={card.imageUrls[0]} alt="" />,
}));
jest.mock(
    "@features/spaces/create/components/DestinationSelector/useRooms",
    () => ({ useRooms: () => ({ updateRoom: mockUpdate }) })
);
jest.mock(
    "@features/spaces/create/components/DestinationSelector/Uploader/UploaderProvider",
    () => ({
        useUploader: () => ({
            submitForReview: mockSubmit,
            mint: mockMint,
            editPhysics: mockEdit,
        }),
    })
);
jest.mock(
    "@features/spaces/create/components/DestinationSelector/Uploader/Actions",
    () => ({
        ActionMenu: ({ destination, triggerLabel }) => {
            mockDestination = destination;
            return (
                <div>
                    <button>{triggerLabel}</button>
                    <div className="items">
                        <button onClick={mockAction}>Existing action</button>
                    </div>
                </div>
            );
        },
    })
);
jest.mock(
    "@features/spaces/create/components/DestinationSelector/Uploader/DropGlb",
    () => ({
        DropGlb: ({ isKitbash, onFileSelect }) => (
            <button
                onClick={() => onFileSelect(new File(["glb"], "gallery.glb"))}
            >
                {isKitbash ? "Choose Kitbash" : "Choose gallery"}
            </button>
        ),
    })
);
jest.mock(
    "@3utils/defaultroomparameters",
    () => ({ DefaultRoomParameters: { testDefault: true } }),
    { virtual: true }
);
jest.mock("@utils/js", () => ({
    deepClone: (value) => JSON.parse(JSON.stringify(value)),
}));
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const room = {
    _id: "id",
    slug: "gallery",
    name: "My gallery",
    status: "tested",
    params: {},
    contractName: "factory-polygon",
    distributionType: "self_claim_tokens",
    image: "/original.jpg",
} as any;
beforeEach(() => {
    [mockUpdate, mockSubmit, mockMint, mockEdit, mockClose, mockAction].forEach(
        (mock) => mock.mockClear()
    );
    URL.createObjectURL = jest.fn(() => "blob:gallery");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});
function render(value = room) {
    act(() =>
        root.render(<DestinationDetails room={value} onClose={mockClose} />)
    );
}
function click(text: string) {
    const button = Array.from(container.querySelectorAll("button")).find(
        (element) => element.textContent.trim() === text
    );
    act(() => Simulate.click(button));
}
it("passes the full destination to its existing menu and exposes contract/distribution information", () => {
    render();
    expect(mockDestination).toBe(room);
    expect(container.textContent).toContain("Community Polygon");
    expect(container.textContent).toContain("Self claim tokens");
    click("Existing action");
    expect(mockAction).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
});
it("opens the existing review flow, closes details and refreshes the destination on completion", () => {
    render();
    click("Submit for review");
    expect(mockSubmit).toHaveBeenCalledWith(room, expect.any(Function));
    expect(mockClose).toHaveBeenCalledTimes(1);
    mockSubmit.mock.calls[0][1]();
    expect(mockUpdate).toHaveBeenCalledWith("gallery");
});
it("only shows minting for approved destinations and leaves Kitbash review hidden", () => {
    const approved = { ...room, status: "verified" };
    render(approved);
    expect(container.textContent).not.toContain("Submit for review");
    click("Continue to minting");
    expect(mockMint).toHaveBeenCalledWith(approved, expect.any(Function));
    render({ ...room, params: { isFuture: true } });
    expect(container.textContent).not.toContain("Submit for review");
    expect(container.textContent).not.toContain("Continue to minting");
});
it("moves focus into details and returns it to the activating card on close", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    render();
    expect(document.activeElement).toBe(
        container.querySelector('[role="dialog"]')
    );
    act(() =>
        Simulate.keyDown(container.querySelector('[role="dialog"]'), {
            key: "Escape",
        })
    );
    expect(mockClose).toHaveBeenCalledTimes(1);
    act(() => root.render(null));
    expect(document.activeElement).toBe(opener);
    opener.remove();
});
it.each([false, true])(
    "routes a selected GLB into the existing uploader with Kitbash=%s",
    (isFuture) => {
        act(() => root.render(<UploadDestination onClose={mockClose} />));
        expect(mockEdit).not.toHaveBeenCalled();
        click(isFuture ? "Choose Kitbash" : "Choose gallery");
        expect(mockEdit).toHaveBeenCalledWith(
            { params: { testDefault: true, isFuture } },
            { fileURL: "blob:gallery" },
            expect.any(Function)
        );
        expect(mockClose).toHaveBeenCalledTimes(1);
        mockEdit.mock.calls[0][2](room);
        expect(mockUpdate).toHaveBeenCalledWith(room);
    }
);
