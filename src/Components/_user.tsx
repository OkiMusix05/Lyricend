// @ts-nocheck
import React, { useContext } from 'react';
import { IconChevronRight, IconChevronLeft } from '@tabler/icons-react';
import { UnstyledButton, Group, Avatar, Text, Box, useMantineTheme, rem, Button } from '@mantine/core';
import { auth } from '../config/firebase'
import { onAuthStateChanged } from "firebase/auth";
import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth'
import { isSavedCtx } from '../App.js'
import { ModalsProvider, modals } from '@mantine/modals';
import { Notifications, notifications } from '@mantine/notifications';
export function UserPanel() {
    const theme = useMantineTheme();
    /*let isSigned;
    let _uid;
    onAuthStateChanged(auth, (user) => {
        if (user) {
            const uid = user.uid;
            isSigned = true
        } else {
            isSigned = false
        }
    });*/
    const { isSaved, editor } = useContext(isSavedCtx);
    const [isSigned, setIsSigned] = useState(false);
    const [displayName, setDP] = useState('');
    const [userEmail, setUE] = useState('');
    const [pfp, setPFP] = useState('');

    useEffect(() => {
        const authStateListener = onAuthStateChanged(auth, (user) => {
            if (user) {
                setIsSigned(true);
                setDP(user.displayName ?? '');
                setUE(user.email ?? '')
                setPFP(user.photoURL ?? '')
            } else {
                setIsSigned(false);
                setDP('No User');
                setUE('N/A')
                setPFP('${process.env.PUBLIC_URL}/emptypfp.png')
            }
        });

        // Clean up the listener when the component unmounts
        return () => {
            authStateListener();
        };
    }, []);
    const logout = async () => {
        if (isSaved == true || editor.getHTML() == '<p></p>') {
            try {
                await signOut(auth)
                await notifications.show({
                    title: 'Succesful Log-Out!',
                    message: 'Hope to see you back again soon!',
                    styles: (theme) => ({
                        root: {
                            backgroundColor: theme.colors.white,
                            borderColor: theme.colors.red,

                            '&::before': { backgroundColor: theme.colors.teal[6] },
                        },
                    }),
                })
            } catch (err) {
                console.error(err)
            }
        }
        else {
            modals.openConfirmModal({
                title: 'Are you sure you wanna log out?',
                centered: true,
                children: (
                    <Text size="sm">
                        The current song you're working with isn't saved.
                    </Text>
                ),
                labels: { confirm: 'Go back', cancel: "Log Out Anyway" },
                confirmProps: { color: 'teal' },
                onCancel: async () => {
                    await signOut(auth)
                    notifications.show({
                        title: 'Logged Out',
                        message: 'Changes to the song were not saved',
                        styles: (theme) => ({
                            root: {
                                backgroundColor: theme.colors.white,
                                borderColor: theme.colors.red,

                                '&::before': { backgroundColor: theme.colors.pink[6] },
                            },
                        }),
                    })
                },
                onConfirm: () => {
                    notifications.show({
                        title: 'Not Logged Out',
                        message: 'You can still save the song you\'re working with!',
                    })
                },
            });
        }
    }
    const sigin = async () => {
        console.log("Hi")
    }


    return (
        <Box
            sx={{
                paddingTop: theme.spacing.sm,
                borderTop: `${rem(1)} solid ${theme.colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[2]
                    }`,
            }}
        >
            <UnstyledButton
                sx={{
                    display: 'block',
                    width: '100%',
                    padding: theme.spacing.xs,
                    borderRadius: theme.radius.sm,
                    color: theme.colorScheme === 'dark' ? theme.colors.dark[0] : theme.black,

                    '&:hover': {
                        backgroundColor:
                            theme.colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[0],
                    },
                }}
            >
                <Group>
                    <Avatar
                        src={isSigned ? pfp : 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'}
                        radius="xl"
                    />
                    <Box sx={{ flex: 1 }}>
                        <Text size="sm" weight={500}>
                            {isSigned ? displayName : "No User"}
                        </Text>
                        <Text color="dimmed" size="xs">
                            {isSigned ? userEmail.split('@')[0] : ""}
                        </Text>
                    </Box>

                    {theme.dir === 'ltr' ? (
                        <IconChevronRight size={rem(18)} />
                    ) : (
                        <IconChevronLeft size={rem(18)} />
                    )}
                    <Button size="xs" color="pink" radius="sm" onClick={isSigned ? logout : sigin}>
                        {isSigned ? "Log Out" : "Log In"}
                    </Button>
                </Group>
            </UnstyledButton>
        </Box>
    );
}