// @ts-nocheck
import { useState } from 'react';
import { IconX, IconCheck } from '@tabler/icons-react';
import React from 'react';
import { useToggle } from '@mantine/hooks';
import { useDisclosure } from '@mantine/hooks';
import { useEffect } from 'react';
import {
    PasswordInput,
    Text,
    Progress,
    Popover,
    Box,
} from '@mantine/core';
//import { createFormContext } from '@mantine/form';

function PasswordRequirement({ meets, label }: { meets: boolean; label: string }) {
    return (
        <Text
            color={meets ? 'teal' : 'red'}
            sx={{ display: 'flex', alignItems: 'center' }}
            mt={7}
            size="sm"
        >
            {meets ? <IconCheck size="0.9rem" /> : <IconX size="0.9rem" />} <Box ml={10}>{label}</Box>
        </Text>
    );
}

const requirements = [
    { re: /[0-9]/, label: 'Includes number' },
    { re: /[a-z]/, label: 'Includes lowercase letter' },
    { re: /[A-Z]/, label: 'Includes uppercase letter' },
    { re: /[$&+,:;=?@#|'<>.^*()%!-]/, label: 'Includes special symbol' },
];

function getStrength(password: string) {
    let multiplier = password.length > 5 ? 0 : 1;

    requirements.forEach((requirement) => {
        if (!requirement.re.test(password)) {
            multiplier += 1;
        }
    });

    return Math.max(100 - (100 / (requirements.length + 1)) * multiplier, 10);
}

//export let pwdValue = "";

export function PasswordProgress({ pwdValue, setPwdValue }) {
    const [popoverOpened, setPopoverOpened] = useState(false);
    const [value, setValue] = useState('');
    useEffect(() => {
        setPwdValue(value);
    }, [value, setPwdValue]);
    const checks = requirements.map((requirement, index) => (
        <PasswordRequirement key={index} label={requirement.label} meets={requirement.re.test(value)} />
    ));

    const strength = getStrength(value);
    const color = strength === 100 ? 'teal' : strength > 50 ? 'yellow' : 'red';

    const [type, toggle] = useToggle(['login', 'register']);
    //Authentxication Modal Open/Close
    const [AUopened, { open, close }] = useDisclosure(false);

    //Checks wether the user is or isn't signed
    const [isSigned, setIsSigned] = useState(false);

    return (
        <div>
            <Popover opened={popoverOpened} position="bottom" width="target" transitionProps={{ transition: 'pop' }}>
                <Popover.Target>
                    <div
                        onFocusCapture={() => setPopoverOpened(true)}
                        onBlurCapture={() => setPopoverOpened(false)}
                    >
                        <PasswordInput
                            withAsterisk
                            label="Your password"
                            placeholder="Your password"
                            value={value}
                            onChange={(event) => {
                                setValue(event.currentTarget.value);
                            }}
                        />
                    </div>
                </Popover.Target>
                <Popover.Dropdown>
                    <Progress color={color} value={strength} size={5} mb="xs" />
                    <PasswordRequirement label="Includes at least 6 characters" meets={value.length > 5} />
                    {checks}
                </Popover.Dropdown>
            </Popover>
        </div>
    );
}