// @ts-nocheck
import React, { useContext, createContext, useRef } from 'react';
import { IconChevronRight, IconChevronLeft, IconAt, IconArrowRight, IconCheck, IconUpload, IconPhoto, IconX, IconMinus, IconPlus, IconSun, IconMoonStars } from '@tabler/icons-react';
import { UnstyledButton, Group, Avatar, Text, Box, useMantineTheme, rem, Button, Skeleton, Grid, ActionIcon, Flex, Image, Kbd, LoadingOverlay, NumberInput, createStyles, Checkbox, Indicator, Tooltip } from '@mantine/core';
import { auth, storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, updateProfile } from "firebase/auth";
import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth'
import { isSavedCtx } from '../App.jsx'
import { ModalsProvider, modals } from '@mantine/modals';
import { Notifications, notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { Modal, Paper, TextInput } from '@mantine/core';
import { Dropzone, DropzoneProps, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { useForm } from '@mantine/form';
import { v4 } from 'uuid';

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
    const { isSaved, editor, numOfRhymes, setNumOfRhymes, advancedChecked, setAdvancedChecked, toggleColorScheme, dark } = useContext(isSavedCtx);
    const [isSigned, setIsSigned] = useState(false);
    const [displayName, setDP] = useState('');
    const [userEmail, setUE] = useState('');
    const [pfp, setPFP] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    //const [value, setValue] = useState(numOfRhymes);

    const { classes } = useStyles();
    const handlers = useRef<NumberInputHandlers>(null);

    /*useEffect(() => {
        setNumOfRhymes(value);
    }, [value]);*/

    //Settings Modal
    const [STmodal, { open, close }] = useDisclosure(false);

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
                setPFP('')
            }
            setIsLoading(false);
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

    const form = useForm({
        initialValues: {
            name: '',
        },
    });
    useEffect(() => {
        form.setFieldValue('name', displayName)
    }, [isSigned]);
    const [pfpUpdateVisible, { toggle }] = useDisclosure(false);
    const [files, setFiles] = useState<FileWithPath[]>([]);
    const previews = files.map((file, index) => {
        const imageUrl = URL.createObjectURL(file);
        return (
            <Image
                key={index}
                src={imageUrl}
                imageProps={{ onLoad: () => URL.revokeObjectURL(imageUrl) }}
                height="6rem"
                onLoad={() => URL.revokeObjectURL(imageUrl)}
            />
        );
    });

    const uploadImage = () => {
        if (files[0] === null) return;
        toggle(pfpUpdateVisible);
        const imageRef = ref(storage, `pfps/${userEmail.replace('@', '-') + v4()}`);
        try {
            uploadBytes(imageRef, files[0]).then((snapshot) => {
                getDownloadURL(snapshot.ref).then((url) => {
                    updateProfile(auth.currentUser, { photoURL: url });
                    setPFP(url);
                    toggle(pfpUpdateVisible);
                    close(STmodal);
                    notifications.show({
                        title: 'PFP changed!',
                        message: 'You do look really good in that one, tho...',
                        styles: (theme) => ({
                            root: {
                                backgroundColor: theme.colors.white,
                                borderColor: theme.colors.teal,

                                '&::before': { backgroundColor: theme.colors.teal[6] },
                            },
                        }),
                    });
                });
            });
        } catch (error) {
            notifications.show({
                title: 'An error occurred while uploading your image',
                message: `Error: ${error.code}`,
                styles: (theme) => ({
                    root: {
                        backgroundColor: theme.colors.white,
                        borderColor: theme.colors.teal,

                        '&::before': { backgroundColor: theme.colors.teal[6] },
                    },
                }),
            });
        }
    }
    useEffect(() => {
        console.log(advancedChecked);
    }, [advancedChecked]);

    return (
        <>
            <Box
                sx={{
                    paddingTop: theme.spacing.sm,
                    borderTop: `${rem(1)} solid ${theme.colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[2]
                        }`,
                }}
            >
                <Skeleton visible={isLoading}>
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
                        onClick={(event) => {
                            event.stopPropagation();
                            open(STmodal);
                        }}
                    >
                        <Group>
                            {isLoading ? (<Skeleton height="2rem" circle mb="xl" />) : (
                                <Indicator color="grape" size={14} withBorder inline offset={3} {...(!advancedChecked ? { disabled: true } : null)}>
                                    <Avatar
                                        src={isSigned ? pfp : ''}
                                        radius="xl"
                                    />
                                </Indicator>
                            )}
                            <Box sx={{ flex: 1 }}>
                                {isLoading ? (<><Skeleton height="0.5rem" width="100%" /></>) : (<><Text size="sm" weight={500}>
                                    {isSigned ? displayName : "No User"}
                                </Text>
                                    <Text color="dimmed" size="xs">
                                        {isSigned ? userEmail.split('@')[0] : ""}
                                    </Text></>)}
                            </Box>

                            {theme.dir === 'ltr' ? (
                                <IconChevronRight size={rem(18)} />
                            ) : (
                                <IconChevronLeft size={rem(18)} />
                            )}
                            <Button size="xs" color="pink" radius="sm" onClick={(event) => {
                                event.stopPropagation();
                                if (isSigned) {
                                    logout();
                                } else {
                                    sigin();
                                }
                            }}>
                                {isSigned ? "Log Out" : "Log In"}
                            </Button>
                        </Group>
                    </UnstyledButton>
                </Skeleton>
            </Box>
            <Modal opened={STmodal} onClose={close} withCloseButton={false} size="40rem" trapFocus overlayProps={{
                opacity: 0.55,
                blur: 1.5,
            }} centered>
                <Paper radius="md" p="xl" withBorder>
                    <Box>
                        <LoadingOverlay visible={pfpUpdateVisible} overlayBlur={2} />
                        <Group position="apart">
                            <Text size="lg" weight={500}>
                                Settings
                            </Text>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <Tooltip label={dark ? 'Light Mode' : 'Dark Mode'} color="blue" withArrow position="bottom" openDelay={1000}>
                                    <ActionIcon
                                        variant="default"
                                        color={dark ? 'yellow' : 'blue'}
                                        onClick={() => toggleColorScheme()}
                                        title="Toggle color scheme"
                                    >
                                        {dark ? <IconSun size="1.1rem" /> : <IconMoonStars size="1.1rem" />}
                                    </ActionIcon>
                                </Tooltip>
                            </div>
                        </Group>
                        <Grid>
                            <Grid.Col span="auto">
                                <Text fw={400} style={{ marginBottom: '0.2rem' }}>Change Username</Text>
                                <form onSubmit={form.onSubmit((values) => {
                                    updateProfile(auth.currentUser, { displayName: values['name'] });
                                    setDP(values['name']);
                                    close(STmodal);
                                    notifications.show({
                                        title: 'Name changed!',
                                        message: 'Your display name has been succesfully updated',
                                        styles: (theme) => ({
                                            root: {
                                                backgroundColor: theme.colors.white,
                                                borderColor: theme.colors.teal,

                                                '&::before': { backgroundColor: theme.colors.teal[6] },
                                            },
                                        }),
                                    });
                                })}>
                                    <TextInput /*label="Change Username"*/ placeholder="New Username" value={form.values.name} style={{ marginBottom: '1rem' }} rightSection={
                                        <ActionIcon size={24} radius="xl" color={theme.primaryColor} type="submit" variant="filled">
                                            <IconCheck size="1rem" stroke={1.5} />
                                        </ActionIcon>
                                    } onChange={(event) => form.setFieldValue('name', event.currentTarget.value)} icon={<IconAt size="0.8rem" />} />
                                </form>
                                <Text fw={400} style={{ marginBottom: '0.2rem' }}>Num of Rhymes displayed</Text>
                                <div className={classes.wrapper} style={{ marginBottom: '1rem' }}>
                                    <ActionIcon<'button'>
                                        size={28}
                                        variant="transparent"
                                        onClick={() => handlers.current?.decrement()}
                                        //disabled={value === 2}
                                        className={classes.control}
                                        onMouseDown={(event) => event.preventDefault()}
                                    >
                                        <IconMinus size="1rem" stroke={1.5} />
                                    </ActionIcon>

                                    <NumberInput
                                        variant="unstyled"
                                        min={2}
                                        max={20}
                                        handlersRef={handlers}
                                        value={numOfRhymes}
                                        onChange={setNumOfRhymes}
                                        classNames={{ input: classes.input }}
                                    />

                                    <ActionIcon<'button'>
                                        size={28}
                                        variant="transparent"
                                        onClick={() => handlers.current?.increment()}
                                        //disabled={value === 20}
                                        className={classes.control}
                                        onMouseDown={(event) => event.preventDefault()}
                                    >
                                        <IconPlus size="1rem" stroke={1.5} />
                                    </ActionIcon>
                                </div>
                                <Text fw={400}>Keyboard Shortcuts</Text>
                                <ul style={{ marginTop: '0px' }}>
                                    <li>
                                        <Text>Switch Light/Dark Mode: </Text>
                                        <Flex align="center">
                                            <Kbd mr={5}>Ctrl</Kbd>
                                            <span>+</span>
                                            <Kbd ml={5}>J</Kbd>
                                        </Flex>
                                    </li>
                                </ul>
                            </Grid.Col>
                            <Grid.Col span="auto">
                                <Text fw={400} style={{ marginBottom: '0.2rem' }}>Change Profile Picture</Text>
                                <Dropzone
                                    onDrop={setFiles}
                                    onReject={(files) => console.log('rejected files', files)}
                                    maxSize={3 * 1024 ** 2}
                                    maxFiles="1"
                                    accept={IMAGE_MIME_TYPE}
                                    style={{ marginBottom: '0.5rem' }}
                                >
                                    <Group position="center" sx={() => ({ minHeight: "6rem", maxHeight: "6rem", })}>
                                        <Dropzone.Accept>
                                            <IconUpload
                                                size="3.2rem"
                                                stroke={1.5}
                                                color={theme.colors[theme.primaryColor][theme.colorScheme === 'dark' ? 4 : 6]}
                                            />
                                        </Dropzone.Accept>
                                        <Dropzone.Reject>
                                            <IconX
                                                size="3.2rem"
                                                stroke={1.5}
                                                color={theme.colors.red[theme.colorScheme === 'dark' ? 4 : 6]}
                                            />
                                        </Dropzone.Reject>
                                        <Dropzone.Idle>
                                            {files.length !== 0 ? previews : <IconPhoto size="3.2rem" stroke={1.5} />}
                                        </Dropzone.Idle>
                                    </Group>
                                </Dropzone>
                                <Button size="xs" color="blue" radius="sm" fullWidth onClick={uploadImage} style={{ marginBottom: '1rem' }}>Upload</Button>
                                <Text fw={400} style={{ marginBottom: '0.2rem' }}>Premium Settings</Text>
                                <Checkbox
                                    label="Advanced Tools"
                                    checked={advancedChecked}
                                    onChange={(event) => setAdvancedChecked(event.currentTarget.checked)}
                                />
                            </Grid.Col>
                        </Grid>
                    </Box></Paper></Modal>
        </>
    );
}

//Styles for the numOfRhymes NumberInput
const useStyles = createStyles((theme) => ({
    wrapper: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${rem(6)} ${theme.spacing.xs}`,
        borderRadius: theme.radius.sm,
        border: `${rem(1)} solid ${theme.colorScheme === 'dark' ? 'transparent' : theme.colors.gray[3]
            }`,
        backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[6] : theme.white,

        '&:focus-within': {
            borderColor: theme.colors[theme.primaryColor][6],
        },
    },

    control: {
        backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[7] : theme.white,
        border: `${rem(1)} solid ${theme.colorScheme === 'dark' ? 'transparent' : theme.colors.gray[3]
            }`,

        '&:disabled': {
            borderColor: theme.colorScheme === 'dark' ? 'transparent' : theme.colors.gray[3],
            opacity: 0.8,
            backgroundColor: 'transparent',
        },
    },

    input: {
        textAlign: 'center',
        paddingRight: `${theme.spacing.sm} !important`,
        paddingLeft: `${theme.spacing.sm} !important`,
        height: rem(28),
        flex: 1,
    },
}));