import React, { InputHTMLAttributes } from 'react'
import {FormControl,FormLabel,FormErrorMessage,Input} from '@chakra-ui/react'
import {useField} from 'formik'

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
    name:string;
    label:string;
};


const InputFiled:React.FC<InputFieldProps> = ({label,size:_,...props}) => {

    const [field,{error}] = useField(props);

    return (
        <FormControl isInvalid={!!error}>
                <FormLabel htmlFor={field.name}>{label}</FormLabel>
                <Input {...field} {...props} id={field.name} />
                {error ? <FormErrorMessage>{error}</FormErrorMessage> : null}
        </FormControl>
    )
}

export default InputFiled