import React from 'react'
import {
  FormControl,
  FormLabel,
  FormErrorMessage,
  Button,
  Input
} from "@chakra-ui/react"

import {Formik,Form,Field,} from 'formik'
import Wrapper from '../components/Wrapper'
import InputFiled from '../components/InputFiled'
import { useRegisterMutation } from '../generated/graphql'
import {toErrorMap} from '../utils/toErrorMap'
import { useRouter } from 'next/dist/client/router'
import { createUrqlClient } from '../utils/createUrqlClient'
import { withUrqlClient } from 'next-urql'

interface registerProps {

}



const Register:React.FC<registerProps> = ({}) => {
    
    const [,register] = useRegisterMutation();

    const router = useRouter();

    return (
    <Wrapper varient="small">
        <Formik
            initialValues={{ username: "",email:"",password:"" }}
            onSubmit={async (values, {setErrors}) => {
                const resposta = await register({registerOptions: values});
                //console.log(resposta);
                if(resposta.data?.register.errors){
                    setErrors(toErrorMap(resposta.data.register.errors));
                }else if (resposta.data?.register.user){
                    router.push("/");
                }

            }}>
        
        {(props) => (
            <Form>
            <InputFiled name="username" placeholder="username" label="Username"/>

            <InputFiled name="email" placeholder="email" label="email" />

            <InputFiled name="password" placeholder="password" label="Password" type="password"/>


            <Button
                mt={4}
                colorScheme="teal"
                isLoading={props.isSubmitting}
                type="submit"
            >
                Submit
            </Button>
            </Form>
        )}
        </Formik>
    </Wrapper>
    )
}

export default withUrqlClient(createUrqlClient) (Register);
