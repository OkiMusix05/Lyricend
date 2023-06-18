import React from 'react';
import { useToggle, upperFirst } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { IconBrandGoogle, IconBrandTwitter } from '@tabler/icons-react';
import { auth, googleProvider, twitterProvider } from '../config/firebase'
import { createUserWithEmailAndPassword, signInWithPopup, TwitterAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, updateProfile, getAdditionalUserInfo } from 'firebase/auth'
import {
    TextInput,
    PasswordInput,
    Text,
    Paper,
    Group,
    Button,
    Divider,
    Checkbox,
    Anchor,
    Stack,
    Modal,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState, useEffect } from 'react';
import { PasswordProgress, /*pwdValue*/ } from './_pwdProgress'
import { Notifications, notifications } from '@mantine/notifications';
//import { getSongList } from '../App.js';

export function AuthenticationForm(props) {
    const [pwdValue, setPwdValue] = useState('');
    // ...
    const [type, toggle] = useToggle(['login', 'register']);
    //Authentication Modal Open/Close
    const [AUopened, { open, close }] = useDisclosure(false);
    const form = useForm({
        initialValues: {
            email: '',
            name: '',
            pwd: pwdValue,
            terms: true,
        },

        validate: {
            email: (val) => (/^\S+@\S+$/.test(val) ? null : 'Invalid email'),
            pwd: () => (pwdValue.length <= 6 ? 'Double check the password meets all the characteristics' : null),
        },
    });
    const succsesfullySignedIn = () => {
        notifications.show({
            title: 'Succesful Log-In!',
            message: 'Let\'s create something beautiful today',
            styles: (theme) => ({
                root: {
                    backgroundColor: theme.colors.white,
                    borderColor: theme.colors.red,

                    '&::before': { backgroundColor: theme.colors.teal[6] },
                },
            }),
        })
    }
    //Sign in with Google Function
    const signInWithGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            await succsesfullySignedIn();
        } catch (err) {
            console.error(err)
        }
    }
    //Sign in with Twitter - Needs app to be deployed to a url and Firebase tweaks to work
    const signInWithTwitter = async () => {
        signInWithPopup(auth, twitterProvider).then((result) => {
            // This gives you a the Twitter OAuth 1.0 Access Token and Secret.
            // You can use these server side with your app's credentials to access the Twitter API.
            //const credential = TwitterAuthProvider.credentialFromResult(result);
            //const token = credential.accessToken;
            //const secret = credential.secret;

            // The signed-in user info.
            //const user = result.user;
            //console.log(token)
            // IdP data available using getAdditionalUserInfo(result)
            // ...
            succsesfullySignedIn();
        }).catch((error) => {
            // Handle Errors here.
            //const errorCode = error.code;
            //const errorMessage = error.message;
            // The email of the user's account used.
            //const email = error.customData.email;
            // The AuthCredential type that was used.
            //const credential = TwitterAuthProvider.credentialFromError(error);
            // ...
        });
    }
    //Regular email sign-in
    const signIn = async (values) => {
        if (type === 'register') {
            try {
                await createUserWithEmailAndPassword(auth, values['email'], pwdValue).then(() => updateProfile(auth.currentUser, { displayName: values['name'] }));
                succsesfullySignedIn();
            } catch (error) {
                switch (error.code) {
                    default:
                        notifications.show({
                            title: 'Unkown Error',
                            message: 'Try again later',
                            styles: (theme) => ({
                                root: {
                                    backgroundColor: theme.colors.white,
                                    borderColor: theme.colors.red,

                                    '&::before': { backgroundColor: theme.colors.pink[6] },
                                },
                            }),
                        });
                        break;
                }
            }
        } else if (type === 'login') {
            try {
                await signInWithEmailAndPassword(auth, values['email'], pwdValue);
            } catch (error) {
                switch (error.code) {
                    case 'auth/wrong-password':
                        form.setFieldError('pwd', 'Incorrect Password');
                        notifications.show({
                            title: 'Incorrect Password',
                            message: 'Try again',
                            styles: (theme) => ({
                                root: {
                                    backgroundColor: theme.colors.white,
                                    borderColor: theme.colors.red,

                                    '&::before': { backgroundColor: theme.colors.pink[6] },
                                },
                            }),
                        });
                        break;
                    case 'auth/too-many-requests':
                        notifications.show({
                            title: 'ACCESS BLOCKED TEMPORARILY',
                            message: 'Too many requests, try again later...',
                            styles: (theme) => ({
                                root: {
                                    backgroundColor: theme.colors.white,
                                    borderColor: theme.colors.red,

                                    '&::before': { backgroundColor: theme.colors.pink[6] },
                                },
                            }),
                        });
                        break;
                    case 'auth/user-not-found':
                        notifications.show({
                            title: 'User Not Found',
                            message: 'Please register first!',
                            styles: (theme) => ({
                                root: {
                                    backgroundColor: theme.colors.white,
                                    borderColor: theme.colors.red,

                                    '&::before': { backgroundColor: theme.colors.pink[6] },
                                },
                            }),
                        });
                        break;
                    default:
                        throw error;
                }
            }
        }
    };

    //Checks wether the user is or isn't signed
    const [isSigned, setIsSigned] = useState(false);

    //Displays the obligatory log-in pop-up if the user isn't signed in
    useEffect(() => {
        const authStateListener = onAuthStateChanged(auth, (user) => {
            if (user) {
                setIsSigned(true);
                close(AUopened);
                //getSongList();
            } else {
                setIsSigned(false);
                form.reset();
                setPwdValue('');
                toggle('login');
                open(AUopened);
            }
        }); // Clean up the listener when the component unmounts
        return () => {
            authStateListener();
        };
    }, [AUopened, close, open]);
    return (
        <Modal opened={AUopened} onClose={close} withCloseButton={false} trapFocus closeOnEscape={false} closeOnClickOutside={false} overlayProps={{
            opacity: 0.55,
            blur: 1.5,
        }} centered>
            <Paper radius="md" p="xl" withBorder {...props}>
                <Text size="lg" weight={500}>
                    Welcome to Lyricend, {type} with
                </Text>

                <Group grow mb="md" mt="md">
                    <Button leftIcon={<IconBrandGoogle size="1rem" radius="xl" />} variant="light" color="red" onClick={signInWithGoogle}>
                        Google
                    </Button>
                    <Button leftIcon={<IconBrandTwitter size="1rem" radius="xl" />} variant="light" color="blue" onClick={signInWithTwitter}>
                        Twitter
                    </Button>
                </Group>

                <Divider label="Or continue with email" labelPosition="center" my="lg" />
                <form onSubmit={form.onSubmit((values) => signIn(values))}>
                    <Stack>
                        {type === 'register' && (
                            <TextInput
                                label="Name"
                                placeholder="Your name"
                                value={form.values.name}
                                onChange={(event) => form.setFieldValue('name', event.currentTarget.value)}
                                radius="md"
                            />
                        )}
                        <>
                            <Text
                                component="label"
                                htmlFor="your-password"
                                size="sm"
                                weight={500}
                            >
                                Email
                            </Text>
                            <TextInput
                                required
                                data-autofocus
                                //label="Email"
                                placeholder="your@email.com"
                                value={form.values.email}
                                onChange={(event) => form.setFieldValue('email', event.currentTarget.value)}
                                error={form.errors.email && 'Invalid email'}
                                radius="md"
                                style={{ marginTop: "-0.8rem" }}
                            />
                        </>
                        {type === 'register' && <PasswordProgress pwdValue={pwdValue} setPwdValue={setPwdValue} />}
                        {type === 'login' && (
                            <>
                                <Group position="apart" mb={5} style={{ alignItems: 'flex-start' }}>
                                    <Text
                                        component="label"
                                        htmlFor="your-password"
                                        size="sm"
                                        weight={500}
                                    >
                                        Password
                                    </Text>

                                    <Anchor
                                        href="#"
                                        onClick={(event) => event.preventDefault()}
                                        sx={(theme) => ({
                                            paddingTop: 2,
                                            color: theme.colors[theme.primaryColor][theme.colorScheme === 'dark' ? 4 : 6],
                                            fontWeight: 500,
                                            fontSize: theme.fontSizes.xs,
                                        })}
                                    >
                                        Forgot your password?
                                    </Anchor>
                                </Group>
                                <PasswordInput
                                    required
                                    //label="Password"
                                    placeholder="Your password"
                                    name="pwd"
                                    value={pwdValue}
                                    onChange={(event) => {
                                        form.setFieldValue('pwd', event.currentTarget.value);
                                        setPwdValue(event.currentTarget.value);
                                    }}
                                    error={form.errors.pwd}
                                    radius="md"
                                    style={{ marginTop: '-1.2rem' }}
                                />
                            </>

                        )}

                        {type === 'register' && (
                            <Checkbox
                                label="I accept terms and conditions"
                                checked={form.values.terms}
                                onChange={(event) => form.setFieldValue('terms', event.currentTarget.checked)}
                            />
                        )}

                        <Group position="right" mt="md">
                            <Anchor
                                component="button"
                                type="button"
                                color="dimmed"
                                onClick={(event) => {
                                    toggle();
                                }}
                                size="xs"
                            >
                                {type === 'register'
                                    ? 'Already have an account? Login'
                                    : "Don't have an account? Register"}
                            </Anchor>
                            <Button type="submit" radius="xl">
                                {upperFirst(type)}
                            </Button>
                        </Group>
                    </Stack>
                </form>
            </Paper>
        </Modal >
    );
}