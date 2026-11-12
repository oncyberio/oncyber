import { useState } from "react";
import Tag from "@ui/components/Tag";
import styled from "styled-components";
import Tabs from "@ui/components/Tabs";
import Alert from "@ui/components/Alert";
import Input from "@ui/components/Input";
import Table from "@ui/components/Table";
import Avatar from "@ui/components/Avatar";
import Slider from "@ui/components/Slider";
import Duplicate from "@ui/icons/Duplicate";
import Dropdown from "@ui/components/Dropdown";
import Textarea from "@ui/components/Textarea";
import { NButton } from "@ui/components/NButton";
import Metrics from "@components/DesignSystem/Metrics";
import ArrowTabRight from "@ui/icons/ArrowTabRight";
import AvatarMulti from "@ui/components/Avatar/multi";
import { useCyberTheme } from "@components/context/ThemeProvider";

const url =
    "https://cyber.mypinata.cloud/ipfs/QmcHebTrCN2rza6AXYn4NhjihY9cSd2dKgDhhXZQCtkFjz?filename=108634060627498605692495755315372089886859055519694745284615741284699317731329.gif";

const columns = [
    { field: "id", headerName: "ID", width: 70 },
    { field: "firstName", headerName: "First name", width: 130 },
    { field: "lastName", headerName: "Last name", width: 130 },
    {
        field: "age",
        headerName: "Age",
        type: "number",
        width: 90,
    },
    {
        field: "remove",
        type: "action",
        headerName: "",
        onClick: () => {
            console.log("Buy now");
        },
    },
];

const RandomComponent = () => {
    return (
        <div>
            <Avatar src={url} size="medium" title="lorem" />
        </div>
    );
};

const rows = [
    {
        id: 1,

        firstName: RandomComponent,

        lastName: "Snow",

        age: 35,

        remove: "remove",
    },
    {
        id: 2,

        firstName: RandomComponent,

        lastName: "Lannister",

        age: 42,

        remove: "remove",
    },
    {
        id: 3,

        firstName: RandomComponent,

        lastName: "Lannister",

        age: 45,

        remove: "remove",
    },
    {
        id: 4,

        firstName: RandomComponent,

        lastName: "Stark",

        age: 16,

        remove: "remove",
    },
    {
        id: 5,

        firstName: RandomComponent,

        lastName: "Targaryen",

        age: null,

        remove: "remove",
    },
    {
        id: 6,

        firstName: RandomComponent,

        lastName: "Melisandre",

        age: 150,

        remove: "remove",
    },
    {
        id: 7,

        firstName: RandomComponent,

        lastName: "Clifford",

        age: 44,

        remove: "remove",
    },
    {
        id: 8,

        firstName: RandomComponent,

        lastName: "Frances",

        age: 36,

        remove: "remove",
    },
    {
        id: 9,

        firstName: RandomComponent,

        lastName: "Roxie",

        age: 65,

        remove: "remove",
    },
];

export default function Design() {
    const error = "";

    const disabled = false;

    const isLoading = false;

    const [active, setActive] = useState("delegated");

    const [openSpaceDetails, setOpenSpaceDetails] = useState(false);

    const [showInviteCollab, setShowInviteCollab] = useState(false);

    const { toggleTheme, isLightTheme } = useCyberTheme();

    return (
        <Container onClick={toggleTheme}>
            <h1>Design system</h1>

            <Avatar src={url} size="small" title="lorem" />

            <Avatar src={url} size="medium" title="lorem" />

            <Avatar src={url} size="large" title="lorem" />

            {/* <AvatarMulti
                avatars={[
                    { title: "lorem", src: url },
                    { title: "lorem", src: url },
                    { title: "lorem", src: url },
                    { title: "lorem", src: url },
                ]}
                size="large"
            />
            <AvatarMulti
                avatars={[
                    { title: "lorem", src: url },
                    { title: "lorem", src: url },
                    { title: "lorem", src: url },
                    { title: "lorem", src: url },
                ]}
            />

            <AvatarMulti
                avatars={[
                    { title: "lorem", src: url },
                    { title: "lorem", src: url },
                    { title: "lorem", src: url },
                    { title: "lorem", src: url },
                ]}
                size="small"
            /> */}

            <Tabs
                tabs={[
                    { title: "Delegated (14)", name: "delegated" },
                    { title: "Owned (2)", name: "owned" },
                    { title: "Minted (0)", name: "minted" },
                ]}
                separator="circle"
                active={active}
                setActive={setActive}
            />
            <Tabs
                tabs={[
                    { title: "Delegated (14)", name: "delegated" },
                    { title: "Owned (2)", name: "owned" },
                    { title: "Minted (0)", name: "minted" },
                ]}
                active={active}
                setActive={setActive}
            />

            <Table rows={rows} columns={columns} />

            {/* <Slider /> */}

            <br />
            <NButton size="small">Buy now</NButton>
            <br />
            <NButton size="medium">Buy now</NButton>
            <br />
            <NButton size="large">Buy now</NButton>

            <br />

            <NButton size="small" outline={true}>
                Buy now
            </NButton>
            <br />

            <NButton size="medium" outline={true}>
                Buy now
            </NButton>
            <br />

            <NButton size="large" outline={true}>
                Buy now
            </NButton>

            <br />

            <NButton size="small" variant="secondary">
                Buy now
            </NButton>
            <br />

            <NButton size="medium" variant="secondary">
                Buy now
            </NButton>
            <br />

            <NButton size="large" variant="secondary">
                Buy now
            </NButton>
            <br />

            <NButton size="small" outline={true} variant="secondary">
                Buy now
            </NButton>
            <br />

            <NButton size="medium" outline={true} variant="secondary">
                Buy now
            </NButton>
            <br />

            <NButton size="large" outline={true} variant="secondary">
                Buy now
            </NButton>
            <br />

            <NButton size="large" outline={true} variant="secondary">
                <span>Buy now</span>
                <ArrowTabRight
                    fill={isLightTheme ? "#070707" : "#fff"}
                    strokeColor={isLightTheme ? "#070707" : "#fff"}
                />
            </NButton>
            <br />

            <NButton size="large" outline={true} variant="secondary">
                <ArrowTabRight
                    fill={isLightTheme ? "#070707" : "#fff"}
                    strokeColor={isLightTheme ? "#070707" : "#fff"}
                />
                <span style={{ marginRight: 8 }}>Buy now</span>
            </NButton>
            <br />

            <NButton size="large" outline={true} variant="secondary">
                <span>Buy now</span>
                <ArrowTabRight
                    fill={isLightTheme ? "#070707" : "#fff"}
                    strokeColor={isLightTheme ? "#070707" : "#fff"}
                />
            </NButton>

            <br />

            <div style={{ margin: "30px" }}>
                <Tag background="#D54712">Active</Tag>
                <br />
                <Tag dot={false}>Active</Tag>
            </div>

            <Textarea placeholder="Enter a description here…" />

            <br />

            <Input placeholder="Enter text here" />

            <br />

            <Input
                placeholder="Enter text here"
                icon={true}
                iconPosition="left"
            >
                <Duplicate
                    strokeColor="#777980"
                    style={{ marginTop: "05px" }}
                />
            </Input>

            <br />

            <Input
                placeholder="Enter text here"
                icon={true}
                iconPosition="right"
            >
                <Duplicate
                    strokeColor="#777980"
                    style={{ marginTop: "05px" }}
                />
            </Input>

            <br />

            {/* <Dropdown
                items={[
                    "Option #1",
                    "Option #2",
                    "Option #3",
                    "Option #4",
                    "Option #5",
                ]}
                onChange={(val) => console.log(`Value selected : ${val}`)}
            /> */}

            <br />

            <Alert variant="warning">
                In order to Publish, you need to give it a name yo!
            </Alert>

            <br />

            <NButton
                size="large"
                outline={true}
                variant="secondary"
                onClick={() => setShowInviteCollab((prev) => !prev)}
            >
                <span style={{ marginRight: 8 }}>Show Invite Collaborate</span>
            </NButton>

            {/* <Collaborate isHidden={!showInviteCollab} /> */}

            <br />

            <NButton
                size="large"
                outline={true}
                variant="secondary"
                style={{ marginTop: "20px" }}
                onClick={() => setOpenSpaceDetails((prev) => !prev)}
            >
                <span style={{ marginRight: 8 }}>Open Space Details</span>
            </NButton>

            {/* <SpaceDetails
                isOpened={openSpaceDetails}
                setOpen={setOpenSpaceDetails}
            /> */}

            <br />

            {/* <div>
                <Metrics />
            </div> */}

            <br />

            <div style={{ marginTop: "20px", marginBottom: "60px" }}>
                {/* <ChangeSpace isHidden={false} /> */}
            </div>

            <br />

            <div style={{ marginTop: "20px" }}>{/* <BottomNav /> */}</div>
        </Container>
    );
}

const Container = styled.div`
    width: 100%;
    min-height: 100vh;
    padding: 24px;

    h1 {
        color: ${({ theme }) => {
            return theme.colors.text.primary;
        }};

        margin: 0;
        padding: 24px 0;
    }

    background: ${({ theme }) => {
        return theme.colors.background.primary;
    }};
`;
