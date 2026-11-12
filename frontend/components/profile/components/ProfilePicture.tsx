import styled from "styled-components";
import { useCallback, useEffect, useRef } from "react";
import Img from "@components/Img";
import { DEFAULT_PLAYER_AVATAR_PICTURE } from "@components/_3DExhibit-v2/three/constants";

const ProfilePicture = ({ openEdit, isOwner, avatar }) => {
    // useEffect(() => {
    //     // Init
    //     var container = document.getElementById("container"),
    //         inner = document.getElementById("inner");

    //     // Mouse
    //     var mouse = {
    //         _x: 0,
    //         _y: 0,
    //         x: 0,
    //         y: 0,
    //         updatePosition: function (event) {
    //             var e = event || window.event;
    //             this.x = e.clientX - this._x;
    //             this.y = (e.clientY - this._y) * -1;
    //         },
    //         setOrigin: function (e) {
    //             this._x = e.offsetLeft + Math.floor(e.offsetWidth / 2);
    //             this._y = e.offsetTop + Math.floor(e.offsetHeight / 2);
    //         },
    //         show: function () {
    //             return "(" + this.x + ", " + this.y + ")";
    //         },
    //     };

    //     // Track the mouse position relative to the center of the container.
    //     mouse.setOrigin(container);

    //     //----------------------------------------------------

    //     var counter = 0;
    //     var refreshRate = 10;
    //     var isTimeToUpdate = function () {
    //         return counter++ % refreshRate === 0;
    //     };

    //     //----------------------------------------------------

    //     var onMouseEnterHandler = function (event) {
    //         update(event);
    //     };

    //     var onMouseLeaveHandler = function () {
    //         inner.style = "";
    //     };

    //     var onMouseMoveHandler = function (event) {
    //         if (isTimeToUpdate()) {
    //             update(event);
    //         }
    //     };

    //     //----------------------------------------------------

    //     var update = function (event) {
    //         mouse.updatePosition(event);
    //         updateTransformStyle(
    //             (mouse.y / inner.offsetHeight / 2).toFixed(2),
    //             (mouse.x / inner.offsetWidth / 2).toFixed(2)
    //         );
    //     };

    //     var updateTransformStyle = function (x, y) {
    //         var style = "rotateX(" + x + "deg) rotateY(" + y + "deg)";
    //         inner.style.transform = style;
    //         inner.style.webkitTransform = style;
    //         inner.style.mozTranform = style;
    //         inner.style.msTransform = style;
    //         inner.style.oTransform = style;
    //     };

    //     //--------------------------------------------------------

    //     container.onmousemove = onMouseMoveHandler;
    //     container.onmouseleave = onMouseLeaveHandler;
    //     container.onmouseenter = onMouseEnterHandler;
    // });

    return (
        <Container id="container">
            {/* <div id="inner"> */}
            {/* <div className="img"> */}
            <Img
                className="profile"
                src={avatar || "/images/avatar.png"}
                alt={avatar}
                fallbackImg={DEFAULT_PLAYER_AVATAR_PICTURE}
            />
            {isOwner && (
                <Edit onClick={openEdit}>
                    <img src="/v2/icons/pen.svg" />
                </Edit>
            )}
            {/* </div> */}
            {/* </div> */}
        </Container>
    );
};

const Container = styled.div`
    border-radius: 120px;
    width: 120px;
    height: 120px;
    background: transparent;
    position: relative;

    .profile {
        display: block;
        margin: 0 auto;
        fill: white;
        width: 100%;
        height: 100%;
        border-radius: 100px;
    }

    @media (max-width: 800px) {
        border-radius: 100px;
        width: 100px;
        height: 100px;
    }

    @media (max-width: 550px) {
        border-radius: 80px;
        width: 80px;
        height: 80px;
    }
`;

const Edit = styled.div`
    background: black;
    position: absolute;
    right: 0px;
    bottom: 0px;
    width: 35px;
    height: 35px;
    border-radius: 35px;
    padding: 4px;

    display: flex;
    align-items: center;
    justify-content: center;

    cursor: pointer;

    img {
        width: 45%;
        margin: 0 auto;
    }

    transition: 0.2s;
    &:hover {
        opacity: 0.5;
    }

    @media (max-width: 800px) {
        width: 30px;
        height: 30px;
    }
`;

export default ProfilePicture;
