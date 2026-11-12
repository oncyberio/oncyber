import { useRef, useState } from "react";

import { PulseIcon } from "@components/_3DExhibit-v2/ui/ControlPanel/Mint/MintNotification/Notification";

import AIStore from "../utils/AIStore";

import AIApi from "@api/ai/_api";

import Mic from "@ui/components/Icons/Mic";
import { Button } from "./shared";
import { AI_ACTIONS } from "../context/types";

export default function Whisper({ dispatch, submitIntent, prompt }) {
    const [isRecording, setIsRecording] = useState(false);

    const mediaRecorder = useRef<MediaRecorder>(null);

    function registerIntent() {
        const MIN_DECIBELS = -45;

        if (
            mediaRecorder.current &&
            mediaRecorder.current.state === "recording"
        ) {
            mediaRecorder.current.stop();

            setIsRecording(false);

            return;
        }

        setIsRecording(true);

        // TODO: detect silence and automatically pause recording
        // https://stackoverflow.com/questions/522251/whats-the-best-way-to-detect-silence-in-a-web-audio-api-application

        // TODO: stop recording after 10s

        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
            mediaRecorder.current = new MediaRecorder(stream, {
                mimeType: "audio/webm;codecs=opus",
            });

            MediaRecorder.isTypeSupported("audio/webm;codecs=opus");

            mediaRecorder.current.start();

            const audioChunks = [];

            mediaRecorder.current.addEventListener("dataavailable", (event) => {
                audioChunks.push(event.data);
            });

            const audioContext = new AudioContext();

            const audioStreamSource =
                audioContext.createMediaStreamSource(stream);

            const analyser = audioContext.createAnalyser();

            analyser.minDecibels = MIN_DECIBELS;

            audioStreamSource.connect(analyser);

            mediaRecorder.current.addEventListener("stop", async () => {
                const audioBlob = new Blob(audioChunks, {
                    type: "audio/webm",
                });

                const audioUrl = URL.createObjectURL(audioBlob);

                const audio = new Audio(audioUrl);

                audio.play();

                const reader = new FileReader();

                reader.readAsDataURL(audioBlob);

                reader.onloadend = async function () {
                    const base64data = reader.result;

                    dispatch({
                        type: AI_ACTIONS.SUBMIT_WHISPER_LOADING,
                    });

                    // setIsExecutingCommand(true);

                    try {
                        const response = await AIApi.getWhisper({
                            audio: base64data as string,
                        });

                        console.log("[ API RESPONSE ]", response);
                        // setIsExecutingCommand(false);

                        if (response.success) {
                            // setIntent(response.data);

                            dispatch({
                                type: AI_ACTIONS.SUBMIT_WHISPER_SUCCESS,
                                payload: {
                                    prompt: {
                                        value: response.data,
                                    },
                                },
                            });

                            submitIntent(response.data);
                        }
                    } catch (err) {
                        // setIsExecutingCommand(false);

                        dispatch({
                            type: AI_ACTIONS.SET_ERROR,
                            payload: {
                                error: err.message || "Failed to fetch intent",
                            },
                        });

                        console.log(err);
                    }
                };
            });
        });
    }

    return !isRecording ? (
        <Button disabled={prompt.state === "loading"} onClick={registerIntent}>
            <Mic fill="#1e1e1e" />
        </Button>
    ) : (
        <PulseIcon
            onClick={registerIntent}
            color="green"
            speed={1}
            style={{
                cursor: "pointer",
                margin: "0 auto",
            }}
        />
    );
}
